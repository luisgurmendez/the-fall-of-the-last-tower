/**
 * Abilities Module
 *
 * This module contains the ability handler system for decoupled ability execution.
 *
 * Architecture:
 * - IAbilityHandler: Interface for ability handlers
 * - BaseAbilityHandler: Base class with utility methods
 * - AbilityHandlerRegistry: Central registry for handler lookup
 * - handlers/: Champion-specific ability handlers
 */

// Core interfaces and types
export * from './IAbilityHandler';

// Base class
export { BaseAbilityHandler } from './BaseAbilityHandler';

// Registry
export { abilityHandlerRegistry } from './AbilityHandlerRegistry';

// Champion handlers - import and register
import { registerLumeHandlers } from './handlers/lume';
import { registerVexHandlers } from './handlers/vex';
import { registerWarriorHandlers } from './handlers/warrior';
import { registerMagnusHandlers } from './handlers/magnus';
import { registerElaraHandlers } from './handlers/elara';
import { registerGorathHandlers } from './handlers/gorath';
import { registerVileHandlers } from './handlers/vile';

/**
 * Initialize all ability handlers.
 * Call this once during server startup.
 */
export function initializeAbilityHandlers(): void {
  registerLumeHandlers();
  registerVexHandlers();
  registerWarriorHandlers();
  registerMagnusHandlers();
  registerElaraHandlers();
  registerGorathHandlers();
  registerVileHandlers();
}
