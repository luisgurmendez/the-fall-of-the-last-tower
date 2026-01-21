/**
 * Represents the cost of casting an ability.
 */

import type { Champion } from '@/champions/Champion';

export interface AbilityCostConfig {
  /** Energy/Mana cost */
  energy?: number;
  /** Health cost (as flat value) */
  health?: number;
  /** Health cost (as percentage of current health) */
  healthPercent?: number;
  /** Cooldown in seconds */
  cooldown?: number;
  /** Number of charges (if ability uses charge system) */
  charges?: number;
}

/**
 * Defines the resource cost of an ability.
 */
class AbilityCost {
  readonly energy: number;
  readonly health: number;
  readonly healthPercent: number;
  readonly cooldown: number;
  readonly charges: number;

  constructor(config: AbilityCostConfig = {}) {
    this.energy = config.energy ?? 0;
    this.health = config.health ?? 0;
    this.healthPercent = config.healthPercent ?? 0;
    this.cooldown = config.cooldown ?? 0;
    this.charges = config.charges ?? 0;
  }

  /**
   * Check if a champion can afford this cost.
   */
  canAfford(champion: Champion): boolean {
    const stats = champion.getStats();

    // Check energy/mana
    if (this.energy > 0 && stats.resource < this.energy) {
      return false;
    }

    // Check health cost (need more than the cost to survive)
    const healthCost = this.getHealthCost(champion);
    if (healthCost > 0 && stats.health <= healthCost) {
      return false;
    }

    return true;
  }

  /**
   * Calculate the total health cost.
   */
  getHealthCost(champion: Champion): number {
    const stats = champion.getStats();
    let cost = this.health;

    if (this.healthPercent > 0) {
      cost += stats.health * this.healthPercent;
    }

    return cost;
  }

  /**
   * Pay the cost.
   */
  pay(champion: Champion): void {
    // Pay energy
    if (this.energy > 0) {
      champion.consumeResource(this.energy);
    }

    // Pay health
    const healthCost = this.getHealthCost(champion);
    if (healthCost > 0) {
      champion.takeDamage(healthCost, 'true', champion);
    }
  }

  /**
   * Get a description of the cost.
   */
  getDescription(): string {
    const parts: string[] = [];

    if (this.energy > 0) {
      parts.push(`${this.energy} Energy`);
    }

    if (this.health > 0) {
      parts.push(`${this.health} Health`);
    }

    if (this.healthPercent > 0) {
      parts.push(`${(this.healthPercent * 100).toFixed(0)}% Current Health`);
    }

    if (this.cooldown > 0) {
      parts.push(`${this.cooldown}s Cooldown`);
    }

    return parts.join(', ') || 'Free';
  }
}

export default AbilityCost;
