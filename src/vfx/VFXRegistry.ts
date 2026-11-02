/**
 * VFXRegistry - Maps ability IDs to VFX configurations.
 *
 * Defines visual effects for all champion abilities including:
 * - Particle colors and counts
 * - Effect durations and timings
 * - Shape types and parameters
 *
 * The definitions are split per champion under ./champions/; importing this
 * module loads all of them, before anything can call getAbilityVFX. Types
 * live in VFXTypes.ts, champion colors in VFXColors.ts and the registry
 * storage in VFXRegistryStore.ts; all are re-exported here.
 */

// Side effect: registers every champion's ability VFX, and the world VFX (hits, deaths, ...)
import './champions';
import './world';
import './summoners';
import './items';

export {
  registerAbilityVFX,
  getAbilityVFX,
  getAllRegisteredVFX,
} from './VFXRegistryStore';
export { CHAMPION_COLORS } from './VFXColors';

export type {
  VFXPhase,
  VFXEffectType,
  ParticleBurstConfig,
  ExpandingRingConfig,
  ConeSlashConfig,
  GroundCircleConfig,
  TrailConfig,
  BeamConfig,
  ShockwaveConfig,
  ScreenFlashConfig,
  RisingParticlesConfig,
  FallingParticlesConfig,
  OrbitingParticlesConfig,
  ShieldBubbleConfig,
  DashAfterimageConfig,
  VFXEffectConfig,
  AbilityVFXDefinition,
} from './VFXTypes';
