/**
 * VFXManager - Central manager for all visual effects.
 *
 * Responsibilities:
 * - Spawning VFX effects based on ability casts and game events
 * - Updating all active effects each frame
 * - Rendering effects to canvas
 * - Managing particle pools and performance
 *
 * VFXManager is the coordinator: it schedules each phase's effects, owns the
 * particle pool and the active effect lists between frames, and fixes the
 * update and draw order. Each effect family is spawned, updated and drawn
 * by a module in ./active/:
 * - particles.ts: particle bursts, rising, falling and death particles
 * - shapes.ts: ground circles, expanding rings, cone slashes, shockwaves
 *   and beams, drawn from the scheduled effect list
 * - trails.ts: entity trails and dash afterimages
 * - auras.ts: shield bubbles and orbiting particles
 * - screenFlash.ts: full-screen flash
 * - types.ts: the active effect instance types
 *
 * With the GPU layer (src/gpu/), emitGround() and emitTop() add the effects
 * to its two batches (under and over the units) instead of render() drawing
 * them in 2D; the screen flash stays 2D (renderScreenFlash()).
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { FXBatch } from '@/gpu/fx/FXBatch';
import { nearView, shakeScreen } from '@/core/screenShake';
import {
  getGlobalParticlePool,
  type VFXParticlePool,
} from './VFXParticlePool';
import {
  getAbilityVFX,
  type VFXEffectConfig,
  type ParticleBurstConfig,
  type TrailConfig,
  type ScreenFlashConfig,
  type RisingParticlesConfig,
  type FallingParticlesConfig,
  type OrbitingParticlesConfig,
  type ShieldBubbleConfig,
  type DashAfterimageConfig,
} from './VFXRegistry';
import type {
  ActiveEffect,
  ActiveTrail,
  ActiveShieldBubble,
  ActiveOrbitingParticles,
  ScreenFlashState,
  ActiveDashAfterimage,
} from './active/types';
import {
  spawnParticleBurst,
  spawnRisingParticles,
  spawnFallingParticles,
  spawnDeathParticles,
  updateParticle,
  renderParticles,
  emitParticles,
} from './active/particles';
import {
  createTrail,
  createDashAfterimage,
  updateTrails,
  updateDashAfterimages,
  renderTrails,
  renderDashAfterimages,
  emitTrails,
  emitDashAfterimages,
} from './active/trails';
import {
  createShieldBubble,
  createOrbitingParticles,
  updateShields,
  updateOrbitingParticles,
  renderShields,
  renderOrbitingParticles,
  emitShields,
  emitOrbitingParticles,
} from './active/auras';
import {
  createScreenFlash,
  updateScreenFlash,
  renderScreenFlash,
} from './active/screenFlash';
import {
  renderGroundEffects,
  renderShapeEffects,
  emitGroundEffects,
  emitShapeEffects,
} from './active/shapes';

/**
 * Performance statistics.
 */
export interface VFXStats {
  activeEffects: number;
  activeParticles: number;
  activeTrails: number;
  activeShields: number;
  poolStats: { active: number; total: number; maxSize: number };
}

/**
 * VFXManager handles all VFX spawning, updating, and rendering.
 */
export class VFXManager {
  private particlePool: VFXParticlePool;
  private activeEffects: ActiveEffect[] = [];
  private activeTrails: ActiveTrail[] = [];
  private activeShields: ActiveShieldBubble[] = [];
  private activeOrbits: ActiveOrbitingParticles[] = [];
  private activeDashAfterimages: ActiveDashAfterimage[] = [];
  private screenFlash: ScreenFlashState | null = null;
  private stateManager: OnlineStateManager;
  private effectIdCounter = 0;

  // Performance limits
  private static readonly MAX_ACTIVE_EFFECTS = 100;

  constructor(stateManager: OnlineStateManager) {
    this.stateManager = stateManager;
    this.particlePool = getGlobalParticlePool();
  }

  /**
   * Generate unique effect ID.
   */
  private generateId(): string {
    return `vfx_${++this.effectIdCounter}_${Date.now()}`;
  }

  /**
   * Spawn VFX for an ability cast. Effects that follow an entity (trails,
   * shields, orbits) follow the caster, or in phases anchored on the target,
   * the target entity when there is one (a shield cast on an ally).
   */
  spawnAbilityVFX(
    abilityId: string,
    casterX: number,
    casterY: number,
    targetX?: number,
    targetY?: number,
    casterId?: string,
    targetEntityId?: string
  ): void {
    const vfxDef = getAbilityVFX(abilityId);
    if (!vfxDef) {
      // No VFX defined for this ability
      return;
    }

    const now = performance.now();

    // Spawn effects for each phase
    for (const phase of vfxDef.phases) {
      // Determine anchor position
      let anchorX = casterX;
      let anchorY = casterY;

      if (
        phase.anchor === 'target' ||
        phase.anchor === 'ground_target'
      ) {
        if (targetX !== undefined && targetY !== undefined) {
          anchorX = targetX;
          anchorY = targetY;
        }
      }

      const followId = phase.anchor === 'target' && targetEntityId ? targetEntityId : casterId;

      // Schedule effects for this phase
      for (const effectConfig of phase.effects) {
        this.scheduleEffect(
          abilityId,
          effectConfig,
          anchorX,
          anchorY,
          targetX,
          targetY,
          now + phase.delay * 1000,
          phase.duration,
          followId
        );
      }
    }
  }

  /**
   * Schedule an effect to start at a specific time.
   */
  private scheduleEffect(
    abilityId: string,
    config: VFXEffectConfig,
    x: number,
    y: number,
    targetX: number | undefined,
    targetY: number | undefined,
    startTime: number,
    phaseDuration: number,
    casterId?: string
  ): void {
    // Respect effect limits
    if (this.activeEffects.length >= VFXManager.MAX_ACTIVE_EFFECTS) {
      // Remove oldest effect
      const removed = this.activeEffects.shift();
      if (removed) {
        this.cleanupEffect(removed);
      }
    }

    // Get duration from config or use phase duration
    let duration = phaseDuration;
    if ('duration' in config && typeof config.duration === 'number') {
      duration = config.duration;
    }

    const effect: ActiveEffect = {
      id: this.generateId(),
      abilityId,
      config,
      x,
      y,
      targetX,
      targetY,
      startTime,
      duration: duration * 1000, // Convert to ms
      casterId,
      progress: 0,
      started: false,
    };

    this.activeEffects.push(effect);

    // Effects of undelayed phases start right away; delayed ones in update()
    if (startTime <= performance.now()) {
      this.startEffect(effect);
    }
  }

  /**
   * Create the one-shot parts of an effect when it starts: particles, and the
   * trails, shields, orbits, afterimages and screen flash that follow the
   * caster.
   */
  private startEffect(effect: ActiveEffect): void {
    effect.started = true;
    const { config, x, y, targetX, targetY, casterId, startTime } = effect;

    if (config.type === 'particle_burst') {
      spawnParticleBurst(this.particlePool, config as ParticleBurstConfig, x, y, targetX, targetY);
    } else if (config.type === 'rising_particles') {
      spawnRisingParticles(this.particlePool, config as RisingParticlesConfig, x, y);
    } else if (config.type === 'falling_particles') {
      spawnFallingParticles(this.particlePool, config as FallingParticlesConfig, x, y);
    } else if (config.type === 'trail' && casterId) {
      this.activeTrails.push(
        createTrail(this.generateId(), config as TrailConfig, casterId, x, y, startTime)
      );
    } else if (config.type === 'shield_bubble' && casterId) {
      this.activeShields.push(
        createShieldBubble(this.generateId(), config as ShieldBubbleConfig, casterId, x, y, startTime)
      );
    } else if (config.type === 'orbiting_particles' && casterId) {
      this.activeOrbits.push(
        createOrbitingParticles(this.generateId(), config as OrbitingParticlesConfig, casterId, x, y, startTime)
      );
    } else if (config.type === 'dash_afterimage' && casterId) {
      this.activeDashAfterimages.push(
        createDashAfterimage(this.generateId(), config as DashAfterimageConfig, casterId, x, y, startTime)
      );
    } else if (config.type === 'screen_flash') {
      // Only felt near the view, like a shake
      const felt = nearView({ x, y });
      const flash = config as ScreenFlashConfig;
      if (felt > 0) this.screenFlash = createScreenFlash({ ...flash, maxAlpha: flash.maxAlpha * felt }, startTime);
    } else if (config.type === 'screen_shake') {
      shakeScreen(config.intensity, config.duration, { x, y });
    }
  }

  /**
   * Clean up an effect when it expires.
   */
  private cleanupEffect(_effect: ActiveEffect): void {
    // Effect-specific cleanup could go here
  }

  /**
   * Update all active effects.
   */
  update(dt: number): void {
    const now = performance.now();

    // Update particles
    this.particlePool.updateAll(dt, updateParticle);

    // Update active effects
    this.activeEffects = this.activeEffects.filter((effect) => {
      const elapsed = now - effect.startTime;
      if (elapsed < 0) {
        // Effect hasn't started yet
        return true;
      }
      if (!effect.started) {
        this.startEffect(effect);
      }

      effect.progress = Math.min(1, elapsed / effect.duration);

      // Effect still active
      if (elapsed < effect.duration) {
        return true;
      }

      // Effect expired
      this.cleanupEffect(effect);
      return false;
    });

    // Update trails - follow entity positions
    this.activeTrails = updateTrails(this.activeTrails, this.stateManager, now);

    // Update shields
    this.activeShields = updateShields(this.activeShields, now);

    // Update orbiting particles
    this.activeOrbits = updateOrbitingParticles(this.activeOrbits, dt, now);

    // Update dash afterimages
    this.activeDashAfterimages = updateDashAfterimages(
      this.activeDashAfterimages,
      this.stateManager,
      dt,
      now
    );

    // Update screen flash
    this.screenFlash = updateScreenFlash(this.screenFlash, now);
  }

  /**
   * Render all active effects.
   */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    ctx.save();

    const now = performance.now();

    // Render ground effects first (behind entities)
    renderGroundEffects(ctx, this.activeEffects, cameraX, cameraY, now);

    // Render trails
    renderTrails(ctx, this.activeTrails, cameraX, cameraY);

    // Render dash afterimages
    renderDashAfterimages(ctx, this.activeDashAfterimages, cameraX, cameraY);

    // Render particles
    renderParticles(ctx, this.particlePool, cameraX, cameraY);

    // Render expanding rings, shockwaves, etc.
    renderShapeEffects(ctx, this.activeEffects, cameraX, cameraY, now);

    // Render shields attached to entities
    renderShields(ctx, this.activeShields, this.stateManager, cameraX, cameraY, now);

    // Render orbiting particles
    renderOrbitingParticles(ctx, this.activeOrbits, this.stateManager, cameraX, cameraY);

    ctx.restore();

    // Render screen flash (in screen space, not world space)
    renderScreenFlash(ctx, this.screenFlash, now);
  }

  /**
   * Add the effects under the units to a GPU batch: magic circles, light
   * pools, scorch marks.
   */
  emitGround(batch: FXBatch): void {
    emitGroundEffects(batch, this.activeEffects, performance.now());
  }

  /**
   * Add the effects over the units to a GPU batch.
   */
  emitTop(batch: FXBatch): void {
    const now = performance.now();
    emitTrails(batch, this.activeTrails, now);
    emitDashAfterimages(batch, this.activeDashAfterimages);
    emitParticles(batch, this.particlePool);
    emitShapeEffects(batch, this.activeEffects, now);
    emitShields(batch, this.activeShields, this.stateManager, now);
    emitOrbitingParticles(batch, this.activeOrbits, this.stateManager, now);
  }

  /**
   * Draw the screen flash (screen space), for when the GPU draws the rest.
   */
  renderScreenFlash(ctx: CanvasRenderingContext2D): void {
    renderScreenFlash(ctx, this.screenFlash, performance.now());
  }

  /**
   * Spawn death/blood particles at a position.
   * Used for minion deaths.
   */
  spawnDeathParticles(x: number, y: number, color: string = '#8B0000'): void {
    spawnDeathParticles(this.particlePool, x, y, color);
  }

  /**
   * Get current VFX statistics for debugging.
   */
  getStats(): VFXStats {
    return {
      activeEffects: this.activeEffects.length,
      activeParticles: this.particlePool.getStats().active,
      activeTrails: this.activeTrails.length,
      activeShields: this.activeShields.length,
      poolStats: this.particlePool.getStats(),
    };
  }

  /**
   * Drop the effects an entity cast that are still running or waiting to
   * start, e.g. a monster's attack warning when the monster dies mid-wind-up.
   */
  cancelCasterEffects(casterId: string): void {
    this.activeEffects = this.activeEffects.filter((effect) => effect.casterId !== casterId);
  }

  /**
   * Clear all active effects.
   */
  clear(): void {
    this.activeEffects = [];
    this.activeTrails = [];
    this.activeShields = [];
    this.activeOrbits = [];
    this.activeDashAfterimages = [];
    this.screenFlash = null;
    this.particlePool.releaseAll();
  }
}

/**
 * Singleton instance.
 */
let vfxManagerInstance: VFXManager | null = null;

/**
 * Get or create VFX manager.
 */
export function getVFXManager(stateManager?: OnlineStateManager): VFXManager {
  if (!vfxManagerInstance && stateManager) {
    vfxManagerInstance = new VFXManager(stateManager);
  }
  if (!vfxManagerInstance) {
    throw new Error('VFXManager not initialized - provide stateManager on first call');
  }
  return vfxManagerInstance;
}

/**
 * Reset VFX manager (for testing or game restart).
 */
export function resetVFXManager(): void {
  if (vfxManagerInstance) {
    vfxManagerInstance.clear();
    vfxManagerInstance = null;
  }
}
