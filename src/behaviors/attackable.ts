interface Attackable {
  hasBeenAttacked(damage: number): void;
}

export function isAttackable(object: any): object is Attackable {
  return typeof object === "object" && object.hasBeenAttacked !== undefined;
}

export default Attackable;
