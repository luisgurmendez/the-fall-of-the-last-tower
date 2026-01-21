/**
 * ReliableEventQueue - Ensures important game events are delivered reliably.
 *
 * Some events (kills, ability casts, game state changes) must be delivered
 * reliably. This queue tracks event acknowledgments and retries unacknowledged
 * events until they are confirmed received.
 *
 * Events are included in state updates until acknowledged by the client.
 */

import { GameEventType, type GameEvent } from '@siege/shared';

/**
 * Event with tracking metadata.
 */
interface TrackedEvent {
  event: GameEvent;
  eventId: number;
  tick: number;
  attempts: number;
  lastSentTick: number;
}

/**
 * Configuration for reliable event delivery.
 */
export interface ReliableEventQueueConfig {
  /** Max ticks before retry (default: 5) */
  retryIntervalTicks?: number;
  /** Max retry attempts before giving up (default: 10) */
  maxRetries?: number;
  /** Max events to keep in queue (default: 100) */
  maxQueueSize?: number;
}

const DEFAULT_CONFIG: Required<ReliableEventQueueConfig> = {
  retryIntervalTicks: 10,  // ~80ms at 125Hz
  maxRetries: 10,          // ~1.6 seconds total
  maxQueueSize: 100,
};

/**
 * Manages reliable delivery of game events.
 */
export class ReliableEventQueue {
  private config: Required<ReliableEventQueueConfig>;

  // Per-player event queues
  private playerQueues: Map<string, TrackedEvent[]> = new Map();

  // Global event ID counter
  private nextEventId = 1;

  // Last acknowledged event ID per player
  private lastAckedEventId: Map<string, number> = new Map();

  constructor(config: ReliableEventQueueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Queue an event for reliable delivery to a specific player.
   */
  queueEventForPlayer(playerId: string, event: GameEvent, tick: number): number {
    const queue = this.getPlayerQueue(playerId);
    const eventId = this.nextEventId++;

    const tracked: TrackedEvent = {
      event: { ...event, eventId },
      eventId,
      tick,
      attempts: 0,
      lastSentTick: 0,
    };

    queue.push(tracked);

    // Trim queue if too large
    while (queue.length > this.config.maxQueueSize) {
      queue.shift();
    }

    return eventId;
  }

  /**
   * Queue an event for all players.
   */
  queueEventForAll(playerIds: string[], event: GameEvent, tick: number): void {
    for (const playerId of playerIds) {
      this.queueEventForPlayer(playerId, event, tick);
    }
  }

  /**
   * Get events that need to be sent to a player this tick.
   * Includes both new events and retries for unacknowledged events.
   */
  getEventsToSend(playerId: string, currentTick: number): GameEvent[] {
    const queue = this.getPlayerQueue(playerId);
    const events: GameEvent[] = [];

    for (const tracked of queue) {
      const shouldSend =
        tracked.attempts === 0 || // Never sent
        currentTick - tracked.lastSentTick >= this.config.retryIntervalTicks; // Retry interval elapsed

      if (shouldSend && tracked.attempts < this.config.maxRetries) {
        events.push(tracked.event);
        tracked.attempts++;
        tracked.lastSentTick = currentTick;
      }
    }

    return events;
  }

  /**
   * Acknowledge receipt of events up to a certain ID.
   * Removes acknowledged events from the queue.
   */
  acknowledgeEvents(playerId: string, upToEventId: number): void {
    const lastAcked = this.lastAckedEventId.get(playerId) ?? 0;

    // Only process if this is a newer acknowledgment
    if (upToEventId <= lastAcked) {
      return;
    }

    this.lastAckedEventId.set(playerId, upToEventId);

    const queue = this.getPlayerQueue(playerId);

    // Remove all acknowledged events
    const remaining = queue.filter(e => e.eventId > upToEventId);
    this.playerQueues.set(playerId, remaining);
  }

  /**
   * Get pending event count for a player.
   */
  getPendingCount(playerId: string): number {
    return this.getPlayerQueue(playerId).length;
  }

  /**
   * Get failed events (exceeded max retries).
   */
  getFailedEvents(playerId: string): GameEvent[] {
    const queue = this.getPlayerQueue(playerId);
    return queue
      .filter(e => e.attempts >= this.config.maxRetries)
      .map(e => e.event);
  }

  /**
   * Remove failed events from queue.
   */
  clearFailedEvents(playerId: string): void {
    const queue = this.getPlayerQueue(playerId);
    const remaining = queue.filter(e => e.attempts < this.config.maxRetries);
    this.playerQueues.set(playerId, remaining);
  }

  /**
   * Clear all events for a player (on disconnect).
   */
  clearPlayer(playerId: string): void {
    this.playerQueues.delete(playerId);
    this.lastAckedEventId.delete(playerId);
  }

  /**
   * Clear all state.
   */
  clearAll(): void {
    this.playerQueues.clear();
    this.lastAckedEventId.clear();
  }

  /**
   * Get the last acknowledged event ID for a player.
   */
  getLastAckedEventId(playerId: string): number {
    return this.lastAckedEventId.get(playerId) ?? 0;
  }

  /**
   * Get statistics about the queue.
   */
  getStats(): {
    totalPending: number;
    totalFailed: number;
    playerStats: Map<string, { pending: number; failed: number }>;
  } {
    let totalPending = 0;
    let totalFailed = 0;
    const playerStats = new Map<string, { pending: number; failed: number }>();

    for (const [playerId, queue] of this.playerQueues) {
      const pending = queue.filter(e => e.attempts < this.config.maxRetries).length;
      const failed = queue.filter(e => e.attempts >= this.config.maxRetries).length;

      totalPending += pending;
      totalFailed += failed;
      playerStats.set(playerId, { pending, failed });
    }

    return { totalPending, totalFailed, playerStats };
  }

  /**
   * Get or create player queue.
   */
  private getPlayerQueue(playerId: string): TrackedEvent[] {
    let queue = this.playerQueues.get(playerId);
    if (!queue) {
      queue = [];
      this.playerQueues.set(playerId, queue);
    }
    return queue;
  }
}

/**
 * Determines if an event should be sent reliably.
 * Important events that affect gameplay must be delivered.
 */
export function shouldSendReliably(event: GameEvent): boolean {
  // These are critical gameplay events that must be delivered reliably
  const reliableEventTypes: GameEventType[] = [
    GameEventType.CHAMPION_KILL,
    GameEventType.TOWER_DESTROYED,
    GameEventType.DRAGON_KILLED,
    GameEventType.BARON_KILLED,
    GameEventType.INHIBITOR_DESTROYED,
    GameEventType.INHIBITOR_RESPAWNED,
    GameEventType.NEXUS_DESTROYED,
    GameEventType.FIRST_BLOOD,
    GameEventType.ACE,
    GameEventType.LEVEL_UP,
  ];

  return reliableEventTypes.includes(event.type);
}
