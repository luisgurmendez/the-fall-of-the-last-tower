/**
 * Matchmaker - Simple matchmaking for MVP.
 *
 * For MVP:
 * - 1v1 matches only
 * - FIFO queue (first come, first served)
 * - No MMR/skill-based matching
 *
 * Can be extended later for:
 * - 5v5 matches
 * - MMR-based matching
 * - Team balancing
 * - Role selection
 */

import type { Side } from '@siege/shared';
import type { PlayerInfo } from '../game/GameRoom';

/**
 * Player waiting in queue.
 */
export interface QueuedPlayer {
  playerId: string;
  championId: string;
  joinedAt: number;
}

/**
 * Match result when players are matched.
 */
export interface MatchResult {
  players: PlayerInfo[];
  gameId?: string;
}

/**
 * Matchmaker configuration.
 */
export interface MatchmakerConfig {
  /** Number of players per team (default: 1 for 1v1) */
  playersPerTeam?: number;
  /** Queue timeout in ms (default: 5 minutes) */
  queueTimeout?: number;
  /** Callback when a match is found */
  onMatchFound?: (match: MatchResult) => void;
}

/**
 * Simple FIFO matchmaker for MVP.
 */
export class Matchmaker {
  private queue: QueuedPlayer[] = [];
  private playersPerTeam: number;
  private queueTimeout: number;
  private onMatchFound?: (match: MatchResult) => void;

  // Track players to prevent double-queuing
  private queuedPlayerIds: Set<string> = new Set();

  constructor(config: MatchmakerConfig = {}) {
    this.playersPerTeam = config.playersPerTeam ?? 1; // 1v1 by default
    this.queueTimeout = config.queueTimeout ?? 5 * 60 * 1000; // 5 minutes
    this.onMatchFound = config.onMatchFound;
  }

  /**
   * Add a player to the matchmaking queue.
   */
  addToQueue(playerId: string, championId: string): boolean {
    // Check if already in queue
    if (this.queuedPlayerIds.has(playerId)) {
      console.warn(`[Matchmaker] Player ${playerId} is already in queue`);
      return false;
    }

    const queuedPlayer: QueuedPlayer = {
      playerId,
      championId,
      joinedAt: Date.now(),
    };

    this.queue.push(queuedPlayer);
    this.queuedPlayerIds.add(playerId);

    console.log(`[Matchmaker] Player ${playerId} joined queue (${this.queue.length} in queue)`);

    // Try to create a match
    this.tryMatch();

    return true;
  }

  /**
   * Remove a player from the queue.
   */
  removeFromQueue(playerId: string): boolean {
    const index = this.queue.findIndex(p => p.playerId === playerId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    this.queuedPlayerIds.delete(playerId);

    console.log(`[Matchmaker] Player ${playerId} left queue (${this.queue.length} in queue)`);
    return true;
  }

  /**
   * Check if a player is in queue.
   */
  isInQueue(playerId: string): boolean {
    return this.queuedPlayerIds.has(playerId);
  }

  /**
   * Get queue position for a player (1-indexed).
   */
  getQueuePosition(playerId: string): number {
    const index = this.queue.findIndex(p => p.playerId === playerId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Get current queue size.
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Try to create a match from queued players.
   */
  private tryMatch(): MatchResult | null {
    const totalPlayersNeeded = this.playersPerTeam * 2;

    if (this.queue.length < totalPlayersNeeded) {
      return null;
    }

    // Take players from the front of the queue
    const matchedPlayers = this.queue.splice(0, totalPlayersNeeded);

    // Remove from tracking set
    for (const player of matchedPlayers) {
      this.queuedPlayerIds.delete(player.playerId);
    }

    // Assign teams
    const players: PlayerInfo[] = matchedPlayers.map((qp, index) => ({
      playerId: qp.playerId,
      championId: qp.championId,
      side: (index < this.playersPerTeam ? 0 : 1) as Side,
      connected: true,
    }));

    const match: MatchResult = { players };

    console.log(`[Matchmaker] Match found! Blue: ${players.filter(p => p.side === 0).map(p => p.playerId).join(', ')} vs Red: ${players.filter(p => p.side === 1).map(p => p.playerId).join(', ')}`);

    // Notify callback
    this.onMatchFound?.(match);

    return match;
  }

  /**
   * Clean up timed out players from the queue.
   */
  cleanupTimedOut(): number {
    const now = Date.now();
    const timedOut: string[] = [];

    this.queue = this.queue.filter(player => {
      if (now - player.joinedAt > this.queueTimeout) {
        timedOut.push(player.playerId);
        this.queuedPlayerIds.delete(player.playerId);
        return false;
      }
      return true;
    });

    if (timedOut.length > 0) {
      console.log(`[Matchmaker] Removed ${timedOut.length} timed out players from queue`);
    }

    return timedOut.length;
  }

  /**
   * Get queue statistics.
   */
  getStats(): { queueSize: number; playersPerTeam: number; neededForMatch: number } {
    return {
      queueSize: this.queue.length,
      playersPerTeam: this.playersPerTeam,
      neededForMatch: this.playersPerTeam * 2,
    };
  }

  /**
   * Clear the entire queue.
   */
  clear(): void {
    this.queue = [];
    this.queuedPlayerIds.clear();
    console.log('[Matchmaker] Queue cleared');
  }
}
