/**
 * ChampionHooksRegistry - Central registry for champion hooks.
 *
 * Provides lookup of champion hooks by champion ID. The AbilityExecutor and
 * ServerChampion use this to apply champion-specific rules without checking
 * champion IDs.
 *
 * USAGE:
 * 1. Create an object implementing IChampionHooks
 * 2. Register it from handlers/<championId>/index.ts:
 *    championHooksRegistry.register(myChampionHooks)
 * 3. AbilityExecutor and ServerChampion call its hooks for that champion
 */

import type { IChampionHooks } from './IChampionHooks';
import { Logger } from '../utils/Logger';

class ChampionHooksRegistry {
  private hooks: Map<string, IChampionHooks> = new Map();

  /**
   * Register a champion's hooks.
   * @param hooks The hooks to register
   * @throws Error if hooks are already registered for the champion ID
   */
  register(hooks: IChampionHooks): void {
    if (this.hooks.has(hooks.championId)) {
      throw new Error(`Hooks already registered for champion: ${hooks.championId}`);
    }
    this.hooks.set(hooks.championId, hooks);
    Logger.debug('ChampionHooks', `Registered hooks for ${hooks.championId}`);
  }

  /**
   * Get a champion's hooks by champion ID.
   * @returns The hooks, or undefined if none registered
   */
  get(championId: string): IChampionHooks | undefined {
    return this.hooks.get(championId);
  }

  /**
   * Check if hooks are registered for a champion.
   */
  has(championId: string): boolean {
    return this.hooks.has(championId);
  }

  /**
   * Unregister a champion's hooks (mainly for testing).
   */
  unregister(championId: string): boolean {
    return this.hooks.delete(championId);
  }

  /**
   * Clear all registered hooks (mainly for testing).
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Get all champion IDs with registered hooks.
   */
  getRegisteredChampions(): string[] {
    return Array.from(this.hooks.keys());
  }
}

// Export singleton instance
export const championHooksRegistry = new ChampionHooksRegistry();
