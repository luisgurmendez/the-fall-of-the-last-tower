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
  type VFXParticle,
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
  drawTrail,
  drawParticle,
  drawGlowCircle,
} from './effects/VFXPrimitives';

/**
 * Active effect instance - tracks a running VFX.
 */
interface ActiveEffect {
  /** Unique ID for this effect instance */
  id: string;
  /** Ability ID this effect is for */
  abilityId: string;
  /** Effect configuration */
  config: VFXEffectConfig;
  /** World position X */
  x: number;
  /** World position Y */
  y: number;
  /** Target position (for directional effects) */
  targetX?: number;
  targetY?: number;
  /** When this effect started */
  startTime: number;
  /** Duration of this effect */
  duration: number;
  /** Entity ID of caster */
  casterId?: string;
  /** Current phase progress (0-1) */
  progress: number;
}

/**
 * Trail point for trail effects.
 */
interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Active trail effect.
 */
interface ActiveTrail {
  id: string;
  entityId: string;
  color: string;
  thickness: number;
  fadeLength: number;
  points: TrailPoint[];
  duration: number;
  startTime: number;
}

/**
 * Active shield bubble effect.
 */
interface ActiveShieldBubble {
  id: string;
  entityId: string;
  color: string;
  radius: number;
  duration: number;
  startTime: number;
  pulseSpeed?: number;
  hexagonal?: boolean;
}

/**
 * Active orbiting particles effect.
 */
interface ActiveOrbitingParticles {
  id: string;
  entityId: string;
  color: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  count: number;
  duration: number;
  startTime: number;
  particles: Array<{ angle: number }>;
}

/**
 * Screen flash state.
 */
interface ScreenFlashState {
  color: string;
  duration: number;
  maxAlpha: number;
  startTime: number;
}

/**
 * Dash afterimage state.
 */
interface DashAfterimage {
  x: number;
  y: number;
  alpha: number;
  color: string;
}

/**
 * Active dash afterimage effect.
 */
interface ActiveDashAfterimage {
  id: string;
  entityId: string;
  color: string;
  images: DashAfterimage[];
  fadeSpeed: number;
  duration: number;
  startTime: number;
  lastImageTime: number;
  imageInterval: number;
}

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
  private static readonly MAX_PARTICLES_PER_EFFECT = 100;

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
      this.spawnParticleBurst(config as ParticleBurstConfig, x, y, targetX, targetY);
    } else if (config.type === 'rising_particles') {
      this.spawnRisingParticles(config as RisingParticlesConfig, x, y);
    } else if (config.type === 'falling_particles') {
      this.spawnFallingParticles(config as FallingParticlesConfig, x, y);
    } else if (config.type === 'trail' && casterId) {
      this.createTrail(config as TrailConfig, casterId, x, y, startTime);
    } else if (config.type === 'shield_bubble' && casterId) {
      this.createShieldBubble(config as ShieldBubbleConfig, casterId, x, y, startTime);
    } else if (config.type === 'orbiting_particles' && casterId) {
      this.createOrbitingParticles(config as OrbitingParticlesConfig, casterId, x, y, startTime);
    } else if (config.type === 'dash_afterimage' && casterId) {
      this.createDashAfterimage(config as DashAfterimageConfig, casterId, x, y, startTime);
    } else if (config.type === 'screen_flash') {
      this.triggerScreenFlash(config as ScreenFlashConfig, startTime);
    }
  }

  /**
   * Spawn a burst of particles.
   */
  private spawnParticleBurst(
    config: ParticleBurstConfig,
    x: number,
    y: number,
    targetX?: number,
    targetY?: number
  ): void {
    // Calculate base direction toward target
    let baseDirection = config.direction ?? 0;
    if (targetX !== undefined && targetY !== undefined) {
      baseDirection = Math.atan2(targetY - y, targetX - x);
    }

    const count = Math.min(config.count, VFXManager.MAX_PARTICLES_PER_EFFECT);

    for (let i = 0; i < count; i++) {
      const particle = this.particlePool.acquire();
      if (!particle) break;

      // Random angle within spread
      const angleOffset = (Math.random() - 0.5) * config.spread;
      const angle = baseDirection + angleOffset;

      // Random speed
      const speed =
        config.speed.min + Math.random() * (config.speed.max - config.speed.min);

      // Random size
      const size =
        config.size.min + Math.random() * (config.size.max - config.size.min);

      // Random lifetime
      const lifetime =
        config.lifetime.min +
        Math.random() * (config.lifetime.max - config.lifetime.min);

      particle.x = x + (Math.random() - 0.5) * 10;
      particle.y = y + (Math.random() - 0.5) * 10;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = lifetime;
      particle.maxLife = lifetime;
      particle.size = size;
      particle.color = config.color;
      particle.colorSecondary = config.colorSecondary;
      particle.gravity = config.gravity ?? 0;
      particle.friction = config.friction ?? 0;
      particle.effectType = config.particleType ?? 'circle';
      particle.glowIntensity = config.glowIntensity;
      particle.rotation = Math.random() * Math.PI * 2;
      particle.rotationSpeed = (Math.random() - 0.5) * 4;
    }
  }

  /**
   * Spawn rising particles.
   */
  private spawnRisingParticles(
    config: RisingParticlesConfig,
    x: number,
    y: number
  ): void {
    const count = Math.min(config.count, VFXManager.MAX_PARTICLES_PER_EFFECT);

    for (let i = 0; i < count; i++) {
      const particle = this.particlePool.acquire();
      if (!particle) break;

      const speed =
        config.speed.min + Math.random() * (config.speed.max - config.speed.min);
      const size =
        config.size.min + Math.random() * (config.size.max - config.size.min);
      const lifetime =
        config.lifetime.min +
        Math.random() * (config.lifetime.max - config.lifetime.min);

      particle.x = x + (Math.random() - 0.5) * config.spread;
      particle.y = y;
      particle.vx = (Math.random() - 0.5) * 20;
      particle.vy = -speed; // Negative = upward
      particle.life = lifetime;
      particle.maxLife = lifetime;
      particle.size = size;
      particle.color = config.color;
      particle.effectType = config.particleType ?? 'circle';
      particle.rotation = Math.random() * Math.PI * 2;
      particle.rotationSpeed = (Math.random() - 0.5) * 2;
    }
  }

  /**
   * Spawn falling particles.
   */
  private spawnFallingParticles(
    config: FallingParticlesConfig,
    x: number,
    y: number
  ): void {
    const count = Math.min(config.count, VFXManager.MAX_PARTICLES_PER_EFFECT);

    for (let i = 0; i < count; i++) {
      const particle = this.particlePool.acquire();
      if (!particle) break;

      const speed =
        config.speed.min + Math.random() * (config.speed.max - config.speed.min);
      const size =
        config.size.min + Math.random() * (config.size.max - config.size.min);
      const lifetime =
        config.lifetime.min +
        Math.random() * (config.lifetime.max - config.lifetime.min);

      particle.x = x + (Math.random() - 0.5) * config.spread;
      particle.y = y - 100 - Math.random() * 50; // Start above
      particle.vx = (Math.random() - 0.5) * 30;
      particle.vy = speed; // Positive = downward
      particle.life = lifetime;
      particle.maxLife = lifetime;
      particle.size = size;
      particle.color = config.color;
      particle.effectType = config.particleType ?? 'spark';
    }
  }

  /**
   * Create a trail effect attached to an entity.
   */
  private createTrail(
    config: TrailConfig,
    entityId: string,
    x: number,
    y: number,
    startTime: number
  ): void {
    this.activeTrails.push({
      id: this.generateId(),
      entityId,
      color: config.color,
      thickness: config.thickness,
      fadeLength: config.fadeLength,
      points: [{ x, y, time: startTime }],
      duration: config.duration * 1000,
      startTime,
    });
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
   * Create dash afterimage effect attached to an entity.
   */
  private createDashAfterimage(
    config: DashAfterimageConfig,
    entityId: string,
    x: number,
    y: number,
    startTime: number
  ): void {
    this.activeDashAfterimages.push({
      id: this.generateId(),
      entityId,
      color: config.color,
      images: [],
      fadeSpeed: config.fadeSpeed,
      duration: config.duration * 1000,
      startTime,
      lastImageTime: startTime,
      imageInterval: (config.duration * 1000) / config.imageCount,
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
  private cleanupEffect(effect: ActiveEffect): void {
    // Effect-specific cleanup could go here
  }

  /**
   * Update all active effects.
   */
  update(dt: number): void {
    const now = performance.now();

    // Update particles
    this.particlePool.updateAll(dt, (particle, deltaTime) => {
      // Apply velocity
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;

      // Apply gravity
      if (particle.gravity) {
        particle.vy += particle.gravity * deltaTime;
      }

      // Apply friction
      if (particle.friction) {
        const factor = 1 - particle.friction * deltaTime;
        particle.vx *= factor;
        particle.vy *= factor;
      }

      // Apply rotation
      if (particle.rotationSpeed) {
        particle.rotation =
          (particle.rotation ?? 0) + particle.rotationSpeed * deltaTime;
      }

      // Update trail positions
      if (particle.effectType === 'trail' && particle.trailPositions) {
        particle.trailPositions.unshift({ x: particle.x, y: particle.y });
        if (particle.trailPositions.length > (particle.trailLength ?? 10)) {
          particle.trailPositions.pop();
        }
      }

      // Decrease life
      particle.life -= deltaTime;
      return particle.life > 0;
    });

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
    this.activeTrails = this.activeTrails.filter((trail) => {
      const elapsed = now - trail.startTime;
      if (elapsed >= trail.duration) {
        return false;
      }

      // Get entity position
      const entity = this.stateManager.getEntity(trail.entityId);
      if (entity) {
        const lastPoint = trail.points[0];
        const dx = entity.position.x - lastPoint.x;
        const dy = entity.position.y - lastPoint.y;

        // Only add point if entity moved
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          trail.points.unshift({
            x: entity.position.x,
            y: entity.position.y,
            time: now,
          });
        }

        // Limit trail length
        while (trail.points.length > trail.fadeLength) {
          trail.points.pop();
        }
      }

      return true;
    });

    // Update shields
    this.activeShields = this.activeShields.filter((shield) => {
      const elapsed = now - shield.startTime;
      return elapsed < shield.duration;
    });

    // Update orbiting particles
    for (const orbit of this.activeOrbits) {
      const elapsed = (now - orbit.startTime) / 1000;
      for (const particle of orbit.particles) {
        particle.angle += orbit.orbitSpeed * dt;
      }
    }
    this.activeOrbits = this.activeOrbits.filter((orbit) => {
      const elapsed = now - orbit.startTime;
      return elapsed < orbit.duration;
    });

    // Update dash afterimages
    for (const afterimage of this.activeDashAfterimages) {
      const elapsed = now - afterimage.startTime;
      const entity = this.stateManager.getEntity(afterimage.entityId);

      // Only add new images while within duration AND entity is dashing
      const isDashing = entity && (entity as any).isDashing;
      if (isDashing && elapsed < afterimage.duration && now - afterimage.lastImageTime >= afterimage.imageInterval) {
        afterimage.images.unshift({
          x: entity.position.x,
          y: entity.position.y,
          alpha: 0.8,
          color: afterimage.color,
        });
        afterimage.lastImageTime = now;
      }

      // Fade existing images
      for (const image of afterimage.images) {
        image.alpha -= afterimage.fadeSpeed * dt;
      }
      afterimage.images = afterimage.images.filter((img) => img.alpha > 0);
    }
    this.activeDashAfterimages = this.activeDashAfterimages.filter((ai) => {
      return ai.images.length > 0;
    });

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
    for (const trail of this.activeTrails) {
      if (trail.points.length >= 2) {
        const screenPoints = trail.points.map((p) => ({
          x: p.x - cameraX,
          y: p.y - cameraY,
        }));
        drawTrail(ctx, screenPoints, trail.thickness, trail.color, true);
      }
    }

    // Render dash afterimages
    for (const afterimage of this.activeDashAfterimages) {
      for (const image of afterimage.images) {
        ctx.save();
        ctx.globalAlpha = image.alpha * 0.5;
        ctx.fillStyle = image.color;
        ctx.beginPath();
        ctx.arc(image.x - cameraX, image.y - cameraY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render particles
    this.particlePool.forEachActive((particle) => {
      // Translate particle to screen space
      const screenParticle = {
        ...particle,
        x: particle.x - cameraX,
        y: particle.y - cameraY,
      };
      drawParticle(ctx, screenParticle as VFXParticle);
    });

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
    now: number
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
    const count = 8 + Math.floor(Math.random() * 5); // 8-12 particles

    for (let i = 0; i < count; i++) {
      const particle = this.particlePool.acquire();
      if (!particle) break;

      // Random angle for explosion effect
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;

      particle.x = x + (Math.random() - 0.5) * 8;
      particle.y = y + (Math.random() - 0.5) * 8;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - 20; // Slight upward bias
      particle.life = 0.3 + Math.random() * 0.3;
      particle.maxLife = particle.life;
      particle.size = 2 + Math.random() * 3;
      particle.color = color;
      particle.gravity = 200; // Fall down
      particle.friction = 2;
      particle.effectType = 'circle';
    }
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
