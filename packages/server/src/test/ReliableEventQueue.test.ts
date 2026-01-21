/**
 * ReliableEventQueue Unit Tests
 *
 * Tests reliable event delivery with acknowledgments and retries.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ReliableEventQueue, shouldSendReliably } from '../network/ReliableEventQueue';
import { GameEventType, type GameEvent } from '@siege/shared';

function createEvent(type: GameEventType, data: Record<string, unknown> = {}): GameEvent {
  return {
    type,
    timestamp: Date.now(),
    data,
  };
}

describe('ReliableEventQueue', () => {
  let queue: ReliableEventQueue;

  beforeEach(() => {
    queue = new ReliableEventQueue({
      retryIntervalTicks: 5,
      maxRetries: 3,
      maxQueueSize: 50,
    });
  });

  describe('queueEventForPlayer', () => {
    it('should queue event and return event ID', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL, { killerId: 'p1' });

      const eventId = queue.queueEventForPlayer('player-1', event, 1);

      expect(eventId).toBeGreaterThan(0);
      expect(queue.getPendingCount('player-1')).toBe(1);
    });

    it('should assign unique IDs to events', () => {
      const event1 = createEvent(GameEventType.CHAMPION_KILL);
      const event2 = createEvent(GameEventType.TOWER_DESTROYED);

      const id1 = queue.queueEventForPlayer('player-1', event1, 1);
      const id2 = queue.queueEventForPlayer('player-1', event2, 1);

      expect(id1).not.toBe(id2);
    });

    it('should trim queue when exceeding max size', () => {
      const smallQueue = new ReliableEventQueue({ maxQueueSize: 3 });

      for (let i = 0; i < 5; i++) {
        smallQueue.queueEventForPlayer('player-1', createEvent(GameEventType.CHAMPION_KILL), i);
      }

      expect(smallQueue.getPendingCount('player-1')).toBe(3);
    });
  });

  describe('queueEventForAll', () => {
    it('should queue event for all players', () => {
      const event = createEvent(GameEventType.ACE);
      const players = ['player-1', 'player-2', 'player-3'];

      queue.queueEventForAll(players, event, 1);

      expect(queue.getPendingCount('player-1')).toBe(1);
      expect(queue.getPendingCount('player-2')).toBe(1);
      expect(queue.getPendingCount('player-3')).toBe(1);
    });
  });

  describe('getEventsToSend', () => {
    it('should return new events immediately', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      const events = queue.getEventsToSend('player-1', 1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(GameEventType.CHAMPION_KILL);
    });

    it('should include eventId in returned events', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      const eventId = queue.queueEventForPlayer('player-1', event, 1);

      const events = queue.getEventsToSend('player-1', 1);

      expect(events[0].eventId).toBe(eventId);
    });

    it('should not return events before retry interval', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      // First send
      queue.getEventsToSend('player-1', 1);

      // Try to send again before interval
      const events = queue.getEventsToSend('player-1', 3);

      expect(events.length).toBe(0);
    });

    it('should retry events after interval', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      // First send
      queue.getEventsToSend('player-1', 1);

      // After retry interval
      const events = queue.getEventsToSend('player-1', 7);

      expect(events.length).toBe(1);
    });

    it('should stop retrying after max attempts', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      // Exhaust retries
      queue.getEventsToSend('player-1', 1);  // Attempt 1
      queue.getEventsToSend('player-1', 10); // Attempt 2
      queue.getEventsToSend('player-1', 20); // Attempt 3

      // Should not retry anymore
      const events = queue.getEventsToSend('player-1', 30);

      expect(events.length).toBe(0);
    });
  });

  describe('acknowledgeEvents', () => {
    it('should remove acknowledged events', () => {
      const event1 = createEvent(GameEventType.CHAMPION_KILL);
      const event2 = createEvent(GameEventType.TOWER_DESTROYED);

      const id1 = queue.queueEventForPlayer('player-1', event1, 1);
      const id2 = queue.queueEventForPlayer('player-1', event2, 1);

      queue.acknowledgeEvents('player-1', id1);

      expect(queue.getPendingCount('player-1')).toBe(1);
    });

    it('should acknowledge all events up to ID', () => {
      const event1 = createEvent(GameEventType.CHAMPION_KILL);
      const event2 = createEvent(GameEventType.TOWER_DESTROYED);
      const event3 = createEvent(GameEventType.ACE);

      queue.queueEventForPlayer('player-1', event1, 1);
      queue.queueEventForPlayer('player-1', event2, 1);
      const id3 = queue.queueEventForPlayer('player-1', event3, 1);

      queue.acknowledgeEvents('player-1', id3);

      expect(queue.getPendingCount('player-1')).toBe(0);
    });

    it('should ignore stale acknowledgments', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      const eventId = queue.queueEventForPlayer('player-1', event, 1);

      queue.acknowledgeEvents('player-1', eventId);

      // Try to acknowledge with older ID
      queue.acknowledgeEvents('player-1', eventId - 1);

      // Should still be empty
      expect(queue.getPendingCount('player-1')).toBe(0);
    });

    it('should track last acknowledged ID', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      const eventId = queue.queueEventForPlayer('player-1', event, 1);

      queue.acknowledgeEvents('player-1', eventId);

      expect(queue.getLastAckedEventId('player-1')).toBe(eventId);
    });
  });

  describe('getFailedEvents', () => {
    it('should return events that exceeded max retries', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      // Exhaust retries
      queue.getEventsToSend('player-1', 1);
      queue.getEventsToSend('player-1', 10);
      queue.getEventsToSend('player-1', 20);

      const failed = queue.getFailedEvents('player-1');

      expect(failed.length).toBe(1);
      expect(failed[0].type).toBe(GameEventType.CHAMPION_KILL);
    });
  });

  describe('clearFailedEvents', () => {
    it('should remove failed events from queue', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      queue.queueEventForPlayer('player-1', event, 1);

      // Exhaust retries
      queue.getEventsToSend('player-1', 1);
      queue.getEventsToSend('player-1', 10);
      queue.getEventsToSend('player-1', 20);

      queue.clearFailedEvents('player-1');

      expect(queue.getPendingCount('player-1')).toBe(0);
      expect(queue.getFailedEvents('player-1').length).toBe(0);
    });
  });

  describe('clearPlayer', () => {
    it('should clear all state for a player', () => {
      const event = createEvent(GameEventType.CHAMPION_KILL);
      const eventId = queue.queueEventForPlayer('player-1', event, 1);

      queue.acknowledgeEvents('player-1', eventId - 1);

      queue.clearPlayer('player-1');

      expect(queue.getPendingCount('player-1')).toBe(0);
      expect(queue.getLastAckedEventId('player-1')).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const event1 = createEvent(GameEventType.CHAMPION_KILL);

      // Queue events for different players
      queue.queueEventForPlayer('player-1', event1, 1);
      queue.queueEventForPlayer('player-2', event1, 1);

      // Exhaust retries for player-1's event
      queue.getEventsToSend('player-1', 1);
      queue.getEventsToSend('player-1', 10);
      queue.getEventsToSend('player-1', 20);

      // Player-2's event is still pending (never sent)
      const stats = queue.getStats();

      expect(stats.totalPending).toBe(1); // 1 from player-2
      expect(stats.totalFailed).toBe(1);  // 1 failed from player-1
      expect(stats.playerStats.get('player-1')?.failed).toBe(1);
      expect(stats.playerStats.get('player-1')?.pending).toBe(0);
      expect(stats.playerStats.get('player-2')?.pending).toBe(1);
    });
  });
});

describe('shouldSendReliably', () => {
  it('should return true for champion kills', () => {
    const event = createEvent(GameEventType.CHAMPION_KILL);
    expect(shouldSendReliably(event)).toBe(true);
  });

  it('should return true for tower destroyed', () => {
    const event = createEvent(GameEventType.TOWER_DESTROYED);
    expect(shouldSendReliably(event)).toBe(true);
  });

  it('should return true for level up', () => {
    const event = createEvent(GameEventType.LEVEL_UP);
    expect(shouldSendReliably(event)).toBe(true);
  });

  it('should return false for ability cast', () => {
    const event = createEvent(GameEventType.ABILITY_CAST);
    expect(shouldSendReliably(event)).toBe(false);
  });

  it('should return false for item purchased', () => {
    const event = createEvent(GameEventType.ITEM_PURCHASED);
    expect(shouldSendReliably(event)).toBe(false);
  });
});
