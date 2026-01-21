/**
 * Damage types for the Attackable interface.
 * Defined inline to avoid circular imports.
 */
export type AttackDamageType = 'physical' | 'magic' | 'true';

/**
 * Interface for objects that can take damage.
 */
interface Attackable {
  /**
   * Apply damage to this object.
   * @param damage - Raw damage amount
   * @param type - Type of damage (physical, magic, true)
   */
  takeDamage(damage: number, type: AttackDamageType): void;
}

export function isAttackable(object: any): object is Attackable {
  return typeof object === "object" && typeof object.takeDamage === "function";
}

export default Attackable;
