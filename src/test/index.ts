/**
 * Test utilities for the siege game engine.
 *
 * Provides tools for testing champions, abilities, and effects
 * without requiring canvas rendering or a full game context.
 *
 * @example
 * ```typescript
 * import { createTestArena, TestDummy, assert } from '@/test';
 *
 * // Create arena with two champions
 * const { ally, enemy, tick } = createTestArena();
 *
 * // Test damage application
 * const initialHealth = enemy.getCurrentHealth();
 * enemy.takeDamage(100, 'physical');
 * assert.lessThan(enemy.getCurrentHealth(), initialHealth);
 * ```
 */

export { createTestGameContext, TestRunner } from './TestGameContext';
export type { TestGameContextOptions } from './TestGameContext';

export {
  TestDummy,
  createTestArena,
  assert,
  calculateExpectedPhysicalDamage,
  calculateExpectedMagicDamage,
} from './ChampionTestUtils';
export type { TestArena } from './ChampionTestUtils';
