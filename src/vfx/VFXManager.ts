/**
 * VFXManager - Central manager for all visual effects.
 *
 * Responsibilities:
 * - Spawning VFX effects based on ability casts and game events
 * - Updating all active effects each frame
 * - Rendering effects to canvas
 * - Managing particle pools and performance
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import {
  VFXParticlePool,
  getGlobalParticlePool,
} from './VFXParticlePool';
import {
  getAbilityVFX,
  type VFXEffectConfig,
  type ParticleBurstConfig,
  type ExpandingRingConfig,
  type ConeSlashConfig,
  type GroundCircleConfig,
  type TrailConfig,
  type ShockwaveConfig,
  type ScreenFlashConfig,
  type RisingParticlesConfig,
  type FallingParticlesConfig,
  type OrbitingParticlesConfig,
  type ShieldBubbleConfig,
  type DashAfterimageConfig,
} from './VFXRegistry';
import {
  drawExpandingRing,
  drawConeSlash,
  drawGroundCircle,
  drawFilledGroundCircle,
  drawShockwave,
} from './effects/VFXPrimitives';
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
} from './active/particles';
import {
  createTrail,
  createDashAfterimage,
  updateTrails,
  updateDashAfterimages,
  renderTrails,
  renderDashAfterimages,
} from './active/trails';
import {
  createShieldBubble,
  createOrbitingParticles,
  updateShields,
  updateOrbitingParticles,
  renderShields,
  renderOrbitingParticles,
} from './active/auras';
import {
  createScreenFlash,
  updateScreenFlash,
  renderScreenFlash,
} from './active/screenFlash';

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
   * Spawn VFX for an ability cast.
   */
  spawnAbilityVFX(
    abilityId: string,
    casterX: number,
    casterY: number,
    targetX?: number,
    targetY?: number,
    casterId?: string
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
          casterId
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
    };

    this.activeEffects.push(effect);

    // Immediately spawn particles for instant effects
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
      this.screenFlash = createScreenFlash(config as ScreenFlashConfig, startTime);
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
    this.renderGroundEffects(ctx, cameraX, cameraY, now);

    // Render trails
    renderTrails(ctx, this.activeTrails, cameraX, cameraY);

    // Render dash afterimages
    renderDashAfterimages(ctx, this.activeDashAfterimages, cameraX, cameraY);

    // Render particles
    renderParticles(ctx, this.particlePool, cameraX, cameraY);

    // Render expanding rings, shockwaves, etc.
    this.renderActiveEffects(ctx, cameraX, cameraY, now);

    // Render shields attached to entities
    renderShields(ctx, this.activeShields, this.stateManager, cameraX, cameraY, now);

    // Render orbiting particles
    renderOrbitingParticles(ctx, this.activeOrbits, this.stateManager, cameraX, cameraY);

    ctx.restore();

    // Render screen flash (in screen space, not world space)
    renderScreenFlash(ctx, this.screenFlash, now);
  }

  /**
   * Render ground-level effects (circles, zones).
   */
  private renderGroundEffects(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    now: number
  ): void {
    for (const effect of this.activeEffects) {
      if (effect.config.type !== 'ground_circle') continue;
      if (now < effect.startTime) continue;

      const config = effect.config as GroundCircleConfig;
      const screenX = effect.x - cameraX;
      const screenY = effect.y - cameraY;
      const progress = effect.progress;

      let alpha = 1;
      if (config.fadeIn && progress < 0.2) {
        alpha = progress / 0.2;
      }
      if (config.fadeOut && progress > 0.8) {
        alpha = 1 - (progress - 0.8) / 0.2;
      }

      // Pulse effect
      let radius = config.radius;
      if (config.pulseSpeed) {
        const pulse = Math.sin(progress * config.pulseSpeed * Math.PI * 2) * 0.1;
        radius *= 1 + pulse;
      }

      if (config.fillColor) {
        drawFilledGroundCircle(
          ctx,
          screenX,
          screenY,
          radius,
          config.fillColor,
          config.color,
          alpha * 0.3,
          alpha * 0.8
        );
      } else {
        drawGroundCircle(
          ctx,
          screenX,
          screenY,
          radius,
          config.color,
          alpha,
          config.dashed
        );
      }
    }
  }

  /**
   * Render active procedural effects.
   */
  private renderActiveEffects(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    now: number
  ): void {
    for (const effect of this.activeEffects) {
      if (now < effect.startTime) continue;

      const screenX = effect.x - cameraX;
      const screenY = effect.y - cameraY;
      const progress = effect.progress;

      switch (effect.config.type) {
        case 'expanding_ring': {
          const config = effect.config as ExpandingRingConfig;
          const radius =
            config.startRadius +
            (config.endRadius - config.startRadius) * progress;
          const alpha = config.fadeOut !== false ? 1 - progress : 1;
          drawExpandingRing(
            ctx,
            screenX,
            screenY,
            radius,
            config.thickness,
            config.color,
            alpha
          );
          break;
        }

        case 'cone_slash': {
          const config = effect.config as ConeSlashConfig;
          // Calculate direction to target
          let direction = 0;
          if (effect.targetX !== undefined && effect.targetY !== undefined) {
            direction = Math.atan2(
              effect.targetY - effect.y,
              effect.targetX - effect.x
            );
          }

          const alpha = config.fadeOut !== false ? 1 - progress * 0.5 : 1;
          drawConeSlash(
            ctx,
            screenX,
            screenY,
            direction,
            config.arcAngle,
            config.radius * (0.8 + progress * 0.2),
            config.color,
            alpha,
            config.innerRadius
          );
          break;
        }

        case 'shockwave': {
          const config = effect.config as ShockwaveConfig;
          const radius =
            config.startRadius +
            (config.endRadius - config.startRadius) * progress;
          const alpha = 1 - progress;
          drawShockwave(
            ctx,
            screenX,
            screenY,
            radius,
            config.thickness * (1 - progress * 0.5),
            config.color,
            alpha
          );
          break;
        }

        case 'beam': {
          // Beam from origin to target
          if (effect.targetX === undefined || effect.targetY === undefined)
            break;

          const targetScreenX = effect.targetX - cameraX;
          const targetScreenY = effect.targetY - cameraY;
          const alpha = 1 - progress;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = effect.config.color;
          ctx.lineWidth = (effect.config as any).thickness ?? 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(targetScreenX, targetScreenY);
          ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }
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
