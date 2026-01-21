/**
 * DummyBehavior - A passive behavior where the unit just stands still.
 *
 * The unit will:
 * - Not move
 * - Not acquire targets
 * - Not attack
 *
 * Useful for:
 * - Testing
 * - Decorative/background units
 * - Stunned/disabled state
 * - Waiting for orders
 */

import {
  UnitBehavior,
  BehaviorContext,
  BehaviorDecision,
  registerBehavior,
} from './UnitBehavior';

export const DUMMY_BEHAVIOR_ID = 'dummy';

export class DummyBehavior implements UnitBehavior {
  readonly id = DUMMY_BEHAVIOR_ID;
  readonly name = 'Dummy';

  update(_context: BehaviorContext): BehaviorDecision {
    // Do nothing - hold position, don't target, don't attack
    return {
      movement: 'hold',
      targeting: 'clear',
      shouldAttack: false,
    };
  }

  onAttach(): void {
    // Nothing to initialize
  }

  onDetach(): void {
    // Nothing to clean up
  }

  reset(): void {
    // Nothing to reset
  }
}

// Register the behavior
registerBehavior(DUMMY_BEHAVIOR_ID, () => new DummyBehavior());

export default DummyBehavior;
