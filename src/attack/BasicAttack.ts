/**
 * Basic attack configuration and logic.
 */

import type { Champion } from '@/champions/Champion';
import type { BasicAttackModifier } from '@/effects/BasicAttackEnhancementEffect';

export interface BasicAttackConfig {
  /** Attack range in units */
  range: number;
  /** Base damage (if not using champion's AD) */
  baseDamage?: number;
  /** Attack speed (attacks per second) */
  attackSpeed?: number;
  /** Damage type */
  damageType?: 'physical' | 'magic' | 'true';
  /** Whether this is a ranged attack (spawns projectile) */
  isRanged?: boolean;
  /** Projectile speed (if ranged) */
  projectileSpeed?: number;
}

/**
 * Represents a champion's basic attack.
 */
export class BasicAttack {
  readonly range: number;
  readonly baseDamage: number;
  readonly attackSpeed: number;
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly isRanged: boolean;
  readonly projectileSpeed: number;

  private owner: Champion | null = null;
  private cooldownRemaining: number = 0;

  constructor(config: BasicAttackConfig) {
    this.range = config.range;
    this.baseDamage = config.baseDamage ?? 0;
    this.attackSpeed = config.attackSpeed ?? 1;
    this.damageType = config.damageType ?? 'physical';
    this.isRanged = config.isRanged ?? false;
    this.projectileSpeed = config.projectileSpeed ?? 1000;
  }

  /**
   * Set the owner champion.
   */
  setOwner(owner: Champion): void {
    this.owner = owner;
  }

  /**
   * Get the effective attack range (including modifiers).
   */
  getEffectiveRange(): number {
    if (!this.owner) return this.range;

    const modifiers = this.owner.getBasicAttackModifiers();
    let range = this.range;

    for (const mod of modifiers) {
      if (mod.bonusRange) {
        range += mod.bonusRange;
      }
    }

    return range;
  }

  /**
   * Get the attack cooldown in seconds.
   */
  getAttackCooldown(): number {
    if (!this.owner) return 1 / this.attackSpeed;

    const stats = this.owner.getStats();
    const effectiveAS = this.attackSpeed * (1 + stats.attackSpeed);
    return 1 / effectiveAS;
  }

  /**
   * Check if the basic attack is ready.
   */
  isReady(): boolean {
    return this.cooldownRemaining <= 0;
  }

  /**
   * Check if a target is in range.
   */
  isInRange(target: Champion): boolean {
    if (!this.owner) return false;

    const distance = this.owner.getPosition().distanceTo(target.getPosition());
    return distance <= this.getEffectiveRange();
  }

  /**
   * Calculate damage for the attack.
   */
  calculateDamage(): { damage: number; type: 'physical' | 'magic' | 'true' } {
    if (!this.owner) {
      return { damage: this.baseDamage, type: this.damageType };
    }

    const stats = this.owner.getStats();
    let damage = this.baseDamage > 0 ? this.baseDamage : stats.attackDamage;
    let damageType = this.damageType;

    // Apply modifiers
    const modifiers = this.owner.getBasicAttackModifiers();
    for (const mod of modifiers) {
      if (mod.bonusDamage) {
        damage += mod.bonusDamage;
      }
      if (mod.damageMultiplier) {
        damage *= mod.damageMultiplier;
      }
      if (mod.piercing) {
        damageType = 'true';
      }
    }

    return { damage, type: damageType };
  }

  /**
   * Execute the basic attack against a target.
   */
  attack(target: Champion): boolean {
    if (!this.owner || !this.isReady() || !this.isInRange(target)) {
      return false;
    }

    const { damage, type } = this.calculateDamage();

    // Apply damage reduction based on type
    let finalDamage = damage;
    if (type === 'physical') {
      const armor = target.getStats().armor;
      finalDamage = damage * (100 / (100 + armor));
    } else if (type === 'magic') {
      const mr = target.getStats().magicResist;
      finalDamage = damage * (100 / (100 + mr));
    }
    // 'true' damage is not reduced

    // Deal damage
    target.takeDamage(finalDamage, type, this.owner);

    // Consume attack modifiers
    this.owner.consumeBasicAttackModifiers();

    // Start cooldown
    this.cooldownRemaining = this.getAttackCooldown();

    // Trigger on-attack effects
    this.owner.onBasicAttack(target);

    return true;
  }

  /**
   * Update the attack cooldown.
   */
  update(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }
  }

  /**
   * Reset the attack state.
   */
  reset(): void {
    this.cooldownRemaining = 0;
  }
}

export default BasicAttack;
