/**
 * ChampionRecall - Channel back to base.
 *
 * Recall can start out of combat while alive. It is cancelled by moving,
 * attack orders and entering combat (ServerChampion calls cancelRecall()),
 * and by death. After GameConfig.TIMING.RECALL_DURATION seconds the
 * champion teleports to its base with full health and resource.
 *
 * The state (isRecalling, recallProgress) stays on the champion for
 * snapshots and the network layer.
 */

import { Vector, GameConfig } from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';

export class ChampionRecall {
  constructor(private readonly champion: ServerChampion) {}

  /**
   * Start recalling.
   */
  start(): boolean {
    const champion = this.champion;
    if (champion.isRecalling || champion.isDead || champion.inCombat) {
      return false;
    }
    champion.isRecalling = true;
    champion.recallProgress = 0;
    return true;
  }

  /**
   * Cancel recall.
   */
  cancel(): void {
    this.champion.isRecalling = false;
    this.champion.recallProgress = 0;
  }

  /**
   * Update recall.
   */
  update(dt: number): void {
    this.champion.recallProgress += dt;
    if (this.champion.recallProgress >= GameConfig.TIMING.RECALL_DURATION) {
      this.complete();
    }
  }

  /**
   * Complete recall (teleport to base).
   */
  private complete(): void {
    const champion = this.champion;
    champion.isRecalling = false;
    champion.recallProgress = 0;

    // Teleport to spawn
    const spawnPos = champion.side === 0
      ? new Vector(-1100, 1100)
      : new Vector(1100, -1100);
    champion.position.setFrom(spawnPos);

    // Restore health and mana
    const stats = champion.getStats();
    champion.health = stats.maxHealth;
    champion.resource = stats.maxResource;
  }
}
