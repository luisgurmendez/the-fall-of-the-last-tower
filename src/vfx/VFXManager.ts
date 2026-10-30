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
  drawScreenFlash,
  drawGlowCircle,
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
      this.createShieldBubble(config as ShieldBubbleConfig, casterId, x, y, startTime);
    } else if (config.type === 'orbiting_particles' && casterId) {
      this.createOrbitingParticles(config as OrbitingParticlesConfig, casterId, x, y, startTime);
    } else if (config.type === 'dash_afterimage' && casterId) {
      this.activeDashAfterimages.push(
        createDashAfterimage(this.generateId(), config as DashAfterimageConfig, casterId, x, y, startTime)
      );
    } else if (config.type === 'screen_flash') {
      this.triggerScreenFlash(config as ScreenFlashConfig, startTime);
    }
  }

  /**
   * Create a shield bubble effect attached to an entity.
   */
  private createShieldBubble(
    config: ShieldBubbleConfig,
    entityId: string,
    x: number,
    y: number,
    startTime: number
  ): void {
    this.activeShields.push({
      id: this.generateId(),
      entityId,
      color: config.color,
      radius: config.radius,
      duration: config.duration * 1000,
      startTime,
      pulseSpeed: config.pulseSpeed,
      hexagonal: config.hexagonal,
    });
  }

  /**
   * Create orbiting particles effect attached to an entity.
   */
  private createOrbitingParticles(
    config: OrbitingParticlesConfig,
    entityId: string,
    x: number,
    y: number,
    startTime: number
  ): void {
    const particles: Array<{ angle: number }> = [];
    for (let i = 0; i < config.count; i++) {
      particles.push({ angle: (i / config.count) * Math.PI * 2 });
    }

    this.activeOrbits.push({
      id: this.generateId(),
      entityId,
      color: config.color,
      size: config.size,
      orbitRadius: config.orbitRadius,
      orbitSpeed: config.orbitSpeed,
      count: config.count,
      duration: config.duration * 1000,
      startTime,
      particles,
    });
  }

  /**
   * Trigger a screen flash.
   */
  private triggerScreenFlash(
    config: ScreenFlashConfig,
    startTime: number
  ): void {
    this.screenFlash = {
      color: config.color,
      duration: config.duration * 1000,
      maxAlpha: config.maxAlpha,
      startTime,
    };
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
    this.activeShields = this.activeShields.filter((shield) => {
      const elapsed = now - shield.startTime;
      return elapsed < shield.duration;
    });

    // Update orbiting particles
    for (const orbit of this.activeOrbits) {
      for (const particle of orbit.particles) {
        particle.angle += orbit.orbitSpeed * dt;
      }
    }
    this.activeOrbits = this.activeOrbits.filter((orbit) => {
      const elapsed = now - orbit.startTime;
      return elapsed < orbit.duration;
    });

    // Update dash afterimages
    this.activeDashAfterimages = updateDashAfterimages(
      this.activeDashAfterimages,
      this.stateManager,
      dt,
      now
    );

    // Update screen flash
    if (this.screenFlash) {
      const elapsed = now - this.screenFlash.startTime;
      if (elapsed >= this.screenFlash.duration) {
        this.screenFlash = null;
      }
    }
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
    this.renderShields(ctx, cameraX, cameraY, now);

    // Render orbiting particles
    this.renderOrbitingParticles(ctx, cameraX, cameraY, now);

    ctx.restore();

    // Render screen flash (in screen space, not world space)
    if (this.screenFlash) {
      const elapsed = now - this.screenFlash.startTime;
      const progress = elapsed / this.screenFlash.duration;
      // Fade in then fade out
      const alpha =
        progress < 0.3
          ? progress / 0.3
          : 1 - (progress - 0.3) / 0.7;
      drawScreenFlash(
        ctx,
        this.screenFlash.color,
        alpha * this.screenFlash.maxAlpha
      );
    }
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
   * Render shield bubbles attached to entities.
   */
  private renderShields(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    now: number
  ): void {
    for (const shield of this.activeShields) {
      const entity = this.stateManager.getEntity(shield.entityId);
      if (!entity) continue;

      const screenX = entity.position.x - cameraX;
      const screenY = entity.position.y - cameraY;
      const elapsed = (now - shield.startTime) / 1000;
      const progress = elapsed / (shield.duration / 1000);

      // Pulse effect
      let radius = shield.radius;
      if (shield.pulseSpeed) {
        const pulse = Math.sin(elapsed * shield.pulseSpeed * Math.PI * 2) * 0.1;
        radius *= 1 + pulse;
      }

      // Fade out near end
      let alpha = 0.6;
      if (progress > 0.8) {
        alpha *= 1 - (progress - 0.8) / 0.2;
      }

      if (shield.hexagonal) {
        // Draw hexagonal shield
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = shield.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const px = screenX + Math.cos(angle) * radius;
          const py = screenY + Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else {
        // Draw circular shield
        drawGlowCircle(
          ctx,
          screenX,
          screenY,
          radius * 0.9,
          'transparent',
          shield.color,
          radius * 1.2,
          alpha * 0.5
        );
        drawExpandingRing(
          ctx,
          screenX,
          screenY,
          radius,
          2,
          shield.color,
          alpha
        );
      }
    }
  }

  /**
   * Render orbiting particles attached to entities.
   */
  private renderOrbitingParticles(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    _now: number
  ): void {
    for (const orbit of this.activeOrbits) {
      const entity = this.stateManager.getEntity(orbit.entityId);
      if (!entity) continue;

      const centerX = entity.position.x - cameraX;
      const centerY = entity.position.y - cameraY;

      for (const particle of orbit.particles) {
        const px = centerX + Math.cos(particle.angle) * orbit.orbitRadius;
        const py = centerY + Math.sin(particle.angle) * orbit.orbitRadius;

        ctx.save();
        ctx.fillStyle = orbit.color;
        ctx.beginPath();
        ctx.arc(px, py, orbit.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
