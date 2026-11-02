/**
 * ChampionRecall - Channel back to base.
 *
 * Recall can start any time while alive, even in combat (like the classic
 * MOBA). It is cancelled by moving, attack orders, dealing or taking damage
 * (ServerChampion.enterCombat calls cancelRecall()), and by death. After GameConfig.TIMING.RECALL_DURATION seconds the
 * champion teleports to its base with full health and resource.
 *
 * The state (isRecalling, recallProgress) stays on the champion for
 * snapshots and the network layer.
 */

import { GameConfig } from '@siege/shared';
import type { ServerGameContext } from '../../game/ServerGameContext';
import type { ServerChampion } from '../ServerChampion';

export class ChampionRecall {
  constructor(private readonly champion: ServerChampion) {}

  /**
   * Start recalling.
   */
  start(): boolean {
    const champion = this.champion;
    if (champion.isRecalling || champion.isDead) {
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
  update(dt: number, context: ServerGameContext): void {
    this.champion.recallProgress += dt;
    if (this.champion.recallProgress >= GameConfig.TIMING.RECALL_DURATION) {
      this.complete(context);
    }
  }

  /**
   * Complete recall (teleport to base).
   */
  private complete(context: ServerGameContext): void {
    const champion = this.champion;
    champion.isRecalling = false;
    champion.recallProgress = 0;

    // Teleport to the fountain (the spawn point), where the shop is
    const spawnPos = champion.side === 0
      ? context.mapConfig.CHAMPION_SPAWN.BLUE
      : context.mapConfig.CHAMPION_SPAWN.RED;
    champion.position.setFrom(spawnPos);

    // Restore health and mana
    const stats = champion.getStats();
    champion.health = stats.maxHealth;
    champion.resource = stats.maxResource;
  }
}
