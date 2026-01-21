/**
 * Vision module - Bush visibility system.
 */

import Vector from '@/physics/vector';
import { TeamId } from '@/core/Team';

/**
 * Interface for game units that can be in bushes.
 * Minimal interface to avoid circular dependencies.
 */
export interface IGameUnit {
  getPosition(): Vector;
  getTeamId(): TeamId;
}

export { Bush } from './Bush';
export type { BushConfig, BushType } from './Bush';
export { BushGroup } from './BushGroup';
export type { BushGroupConfig } from './BushGroup';
export { BushManager } from './BushManager';
export type { BushVisibilityResult } from './BushManager';
