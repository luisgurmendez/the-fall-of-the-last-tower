/**
 * AbilityHandlerRegistry - Central registry for ability handlers.
 *
 * Provides lookup of ability handlers by ID. The AbilityExecutor uses this
 * to find handlers for abilities that need custom execution logic.
 *
 * USAGE:
 * 1. Create a handler implementing IAbilityHandler
 * 2. Register it: abilityHandlerRegistry.register(new MyAbilityHandler())
 * 3. AbilityExecutor will automatically use it when that ability is cast
 */

import type { IAbilityHandler } from './IAbilityHandler';
import { Logger } from '../utils/Logger';

class AbilityHandlerRegistry {
  private handlers: Map<string, IAbilityHandler> = new Map();

  /**
   * Register an ability handler.
   * @param handler The handler to register
   * @throws Error if a handler is already registered for the ability ID
   */
  register(handler: IAbilityHandler): void {
    if (this.handlers.has(handler.abilityId)) {
      throw new Error(`Handler already registered for ability: ${handler.abilityId}`);
    }
    this.handlers.set(handler.abilityId, handler);
    Logger.debug('AbilityRegistry', `Registered handler for ${handler.abilityId}`);
  }

  /**
   * Register multiple handlers at once.
   */
  registerAll(handlers: IAbilityHandler[]): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * Get a handler by ability ID.
   * @returns The handler, or undefined if none registered
   */
  get(abilityId: string): IAbilityHandler | undefined {
    return this.handlers.get(abilityId);
  }

  /**
   * Check if a handler is registered for an ability.
   */
  has(abilityId: string): boolean {
    return this.handlers.has(abilityId);
  }

  /**
   * Unregister a handler (mainly for testing).
   */
  unregister(abilityId: string): boolean {
    return this.handlers.delete(abilityId);
  }

  /**
   * Clear all registered handlers (mainly for testing).
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get all registered ability IDs.
   */
  getRegisteredAbilities(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Export singleton instance
export const abilityHandlerRegistry = new AbilityHandlerRegistry();
