/**
 * ChampionTrinket - Ward trinket charges.
 *
 * Placing a ward uses a charge and starts a short cooldown. Missing charges
 * come back one at a time every trinketRechargeTime seconds.
 *
 * The state (trinketCharges, trinketCooldown, ...) stays on the champion
 * for snapshots and the network layer.
 */

import type { ServerChampion } from '../ServerChampion';

/** Cooldown after placing a ward, in seconds */
const WARD_PLACEMENT_COOLDOWN = 1;

export class ChampionTrinket {
  constructor(private readonly champion: ServerChampion) {}

  /**
   * Update trinket (ward) charges.
   */
  update(dt: number): void {
    const champion = this.champion;

    // Update cooldown
    if (champion.trinketCooldown > 0) {
      champion.trinketCooldown = Math.max(0, champion.trinketCooldown - dt);
    }

    // Recharge if not at max charges
    if (champion.trinketCharges < champion.trinketMaxCharges) {
      champion.trinketRechargeTimer += dt;

      if (champion.trinketRechargeTimer >= champion.trinketRechargeTime) {
        champion.trinketCharges++;
        champion.trinketRechargeTimer = 0;
      }
    }
  }

  /**
   * Check if can place a ward.
   */
  canPlaceWard(): boolean {
    const champion = this.champion;
    return champion.trinketCharges > 0 && champion.trinketCooldown <= 0 && !champion.isDead;
  }

  /**
   * Consume a trinket charge when placing a ward.
   * Returns true if successful.
   */
  consumeCharge(): boolean {
    const champion = this.champion;
    if (!champion.canPlaceWard()) {
      return false;
    }

    champion.trinketCharges--;
    champion.trinketCooldown = WARD_PLACEMENT_COOLDOWN;

    return true;
  }

  /**
   * Get trinket recharge progress (0-1).
   */
  getRechargeProgress(): number {
    const champion = this.champion;
    if (champion.trinketCharges >= champion.trinketMaxCharges) return 1;
    return champion.trinketRechargeTimer / champion.trinketRechargeTime;
  }
}
