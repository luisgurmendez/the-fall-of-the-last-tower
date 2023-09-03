interface Attackable {
  applyDamage(damage: number): void;
}

export function isAttackable(object: any): object is Attackable {
  return typeof object === "object" && object.applyDamage !== undefined;
}

export default Attackable;
