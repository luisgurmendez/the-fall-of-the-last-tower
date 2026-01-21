/**
 * Global game event bus singleton.
 * Provides a centralized event system for the entire game.
 */

import { EventEmitter } from './EventEmitter';
import { GameEventMap } from './GameEvents';

/**
 * Type-safe game event bus with predefined game events.
 */
class GameEventBus extends EventEmitter {
  private static instance: GameEventBus | null = null;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of the game event bus.
   */
  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    return GameEventBus.instance;
  }

  /**
   * Reset the event bus (useful for game restart).
   */
  static reset(): void {
    if (GameEventBus.instance) {
      GameEventBus.instance.dispose();
      GameEventBus.instance = null;
    }
  }

  /**
   * Type-safe event subscription for game events.
   */
  onGameEvent<K extends keyof GameEventMap>(
    event: K,
    callback: (data: GameEventMap[K]) => void
  ): () => void {
    return this.on(event, callback as (data: unknown) => void);
  }

  /**
   * Type-safe event emission for game events.
   */
  emitGameEvent<K extends keyof GameEventMap>(
    event: K,
    data: GameEventMap[K]
  ): void {
    this.emit(event, data);
  }
}

// Export singleton getter for convenience
export const getGameEventBus = GameEventBus.getInstance;
export const resetGameEventBus = GameEventBus.reset;

export default GameEventBus;
