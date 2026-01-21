/**
 * @deprecated Use WorldEntity, ScreenEntity, or LogicEntity from '@/core/GameObject' instead.
 *
 * This file is kept for backwards compatibility.
 * New code should import from '@/core/GameObject'.
 */

import { WorldEntity } from '@/core/GameObject';

// Re-export WorldEntity as BaseObject for backwards compatibility
export { WorldEntity as default };
export { WorldEntity as BaseObject };
