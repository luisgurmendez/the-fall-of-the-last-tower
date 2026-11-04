/**
 * Abilities Module
 *
 * This module contains the ability handler system for decoupled ability execution.
 *
 * Architecture:
 * - IAbilityHandler: Interface for ability handlers
 * - BaseAbilityHandler: Base class with utility methods
 * - AbilityHandlerRegistry: Central registry for handler lookup
 * - IChampionHooks: Interface for per-champion cast rules
 * - ChampionHooksRegistry: Central registry for champion hook lookup
 * - handlers/: Champion-specific ability handlers and champion hooks
 */

// Core interfaces and types
export * from './IAbilityHandler';
export * from './IChampionHooks';

// Base class
export { BaseAbilityHandler } from './BaseAbilityHandler';

// Registries
export { abilityHandlerRegistry } from './AbilityHandlerRegistry';
export { championHooksRegistry } from './ChampionHooksRegistry';

// Champion handlers - import and register
import { registerLumeHandlers } from './handlers/lume';
import { registerVexHandlers } from './handlers/vex';
import { registerWarriorHandlers } from './handlers/warrior';
import { registerMagnusHandlers } from './handlers/magnus';
import { registerElaraHandlers } from './handlers/elara';
import { registerGorathHandlers } from './handlers/gorath';
import { registerVileHandlers } from './handlers/vile';
import { registerUrukHandlers } from './handlers/uruk';
import { registerOitboilHandlers } from './handlers/oitboil';
import { registerEloraHandlers } from './handlers/elora';
import { registerCaelumHandlers } from './handlers/caelum';
import { registerFenrisHandlers } from './handlers/fenris';
import { registerCalamitusHandlers } from './handlers/calamitus';
import { registerProtobotHandlers } from './handlers/protobot';
import { registerHopHandlers } from './handlers/hop';
import { registerZhakrulHandlers } from './handlers/zhakrul';
import { registerKipHandlers } from './handlers/kip';

/**
 * Initialize all ability handlers and champion hooks.
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
  registerUrukHandlers();
  registerOitboilHandlers();
  registerEloraHandlers();
  registerCaelumHandlers();
  registerFenrisHandlers();
  registerCalamitusHandlers();
  registerProtobotHandlers();
  registerHopHandlers();
  registerZhakrulHandlers();
  registerKipHandlers();
}
