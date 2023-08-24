
export type GConstructor<T = {}> = new (...args: any[]) => T;

// class Obj { }

// const R = PhysicableMixin(PositionableMixin(CollisionableMixin(Obj)));

// interface S{
//   s: ()=>void;
// }
// abstract class Rock extends R implements S { 
//   s(){};
// }


// class RO extends Rock{}

// const ro = new RO();