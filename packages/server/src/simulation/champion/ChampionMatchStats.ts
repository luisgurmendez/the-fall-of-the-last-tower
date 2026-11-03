/**
 * ChampionMatchStats - What a champion did over the match, for the
 * post-match stats (GAME_END's totals).
 *
 * The champion records what it deals and takes, heals, earns, and its wards;
 * kills and deaths keep its killing spree.
 */

import { EntityType, type ChampionMatchTotals } from '@siege/shared';
import type { ServerEntity } from '../ServerEntity';

const STRUCTURES = new Set<EntityType>([EntityType.TOWER, EntityType.INHIBITOR, EntityType.NEXUS]);

export class ChampionMatchStats {
  private readonly totals: ChampionMatchTotals = {
    damageToChampions: 0,
    damageDealt: 0,
    damageTaken: 0,
    healing: 0,
    damageToStructures: 0,
    goldEarned: 0,
    wardsPlaced: 0,
    wardsDestroyed: 0,
    largestKillingSpree: 0,
  };
  /** Kills since it last died */
  private spree = 0;

  /** It dealt `amount` damage to `target` (an enemy: nothing damages allies) */
  dealt(target: ServerEntity, amount: number): void {
    this.totals.damageDealt += amount;
    if (target.entityType === EntityType.CHAMPION) this.totals.damageToChampions += amount;
    else if (STRUCTURES.has(target.entityType)) this.totals.damageToStructures += amount;
  }

  took(amount: number): void {
    this.totals.damageTaken += amount;
  }

  healed(amount: number): void {
    this.totals.healing += amount;
  }

  earned(gold: number): void {
    this.totals.goldEarned += gold;
  }

  placedWard(): void {
    this.totals.wardsPlaced++;
  }

  destroyedWard(): void {
    this.totals.wardsDestroyed++;
  }

  killed(): void {
    this.spree++;
    this.totals.largestKillingSpree = Math.max(this.totals.largestKillingSpree, this.spree);
  }

  died(): void {
    this.spree = 0;
  }

  /** The totals so far, in whole numbers */
  toTotals(): ChampionMatchTotals {
    const totals = { ...this.totals };
    for (const key of Object.keys(totals) as (keyof ChampionMatchTotals)[]) {
      totals[key] = Math.round(totals[key]);
    }
    return totals;
  }
}
