export type Shape = Rectangle | Circle | NullShape;

export class Rectangle {
  public w: number;
  public h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  get maxDistanceToCenter() {
    return Math.max(this.w, this.h);
  }
}

export class Circle {
  public radius: number;

  constructor(r: number) {
    this.radius = r;
  }

  get maxDistanceToCenter() {
    return this.radius;
  }

  get perimeter() {
    return 2 * Math.PI * this.radius;
  }
}

export class Square extends Rectangle {
  constructor(size: number) {
    super(size, size);
  }
}

export class NullShape {
  get maxDistanceToCenter() {
    return 0;
  }
}
