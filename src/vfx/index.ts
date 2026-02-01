/**
 * VFX System - Visual effects for champion abilities.
 *
 * Main exports:
 * - VFXManager: Central manager for spawning, updating, and rendering VFX
 * - VFXParticlePool: Object pooling for particles
 * - VFXRegistry: Ability VFX definitions
 * - VFXPrimitives: Reusable drawing functions
 */

export { VFXManager, getVFXManager, resetVFXManager } from './VFXManager';
export type { VFXStats } from './VFXManager';

export { VFXParticlePool, getGlobalParticlePool } from './VFXParticlePool';
export type { VFXParticle, PooledParticle, PoolConfig } from './VFXParticlePool';

export {
  CHAMPION_COLORS,
  registerAbilityVFX,
  getAbilityVFX,
  getAllRegisteredVFX,
} from './VFXRegistry';
export type {
  AbilityVFXDefinition,
  VFXEffectConfig,
  ParticleBurstConfig,
  ExpandingRingConfig,
  ConeSlashConfig,
  GroundCircleConfig,
  TrailConfig,
  ShockwaveConfig,
  ScreenFlashConfig,
} from './VFXRegistry';

export * from './effects/VFXPrimitives';
