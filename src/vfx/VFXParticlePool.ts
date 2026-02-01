/**
 * VFXParticlePool - Object pooling for VFX particles.
 *
 * Avoids garbage collection by reusing particle objects.
 * Critical for maintaining 60 FPS with many particles.
 */

/**
 * Base particle interface for pooling.
 */
export interface PooledParticle {
  /** Is this particle currently active */
  active: boolean;
  /** World position X */
  x: number;
  /** World position Y */
  y: number;
  /** Velocity X */
  vx: number;
  /** Velocity Y */
  vy: number;
  /** Current life (0-1, decreases over time) */
  life: number;
  /** Initial life value for fade calculations */
  maxLife: number;
  /** Particle size in pixels */
  size: number;
  /** Particle color (hex or rgba) */
  color: string;
  /** Optional: rotation angle in radians */
  rotation?: number;
  /** Optional: rotation speed (radians/sec) */
  rotationSpeed?: number;
  /** Optional: scale factor */
  scale?: number;
  /** Optional: alpha override (0-1) */
  alpha?: number;
  /** Optional: gravity effect */
  gravity?: number;
  /** Optional: friction/drag (0-1) */
  friction?: number;
}

/**
 * Extended particle with additional effect properties.
 */
export interface VFXParticle extends PooledParticle {
  /** Effect type for rendering variations */
  effectType?: 'circle' | 'square' | 'star' | 'trail' | 'spark' | 'ring';
  /** Secondary color for gradients */
  colorSecondary?: string;
  /** Glow intensity (0 = none) */
  glowIntensity?: number;
  /** Trail length for trail particles */
  trailLength?: number;
  /** Previous positions for trail rendering */
  trailPositions?: Array<{ x: number; y: number }>;
}

/**
 * Pool configuration.
 */
export interface PoolConfig {
  /** Initial pool size */
  initialSize: number;
  /** Maximum pool size (hard limit) */
  maxSize: number;
  /** Growth increment when pool is exhausted */
  growthSize: number;
}

const DEFAULT_CONFIG: PoolConfig = {
  initialSize: 200,
  maxSize: 500,
  growthSize: 50,
};

/**
 * Object pool for VFX particles.
 */
export class VFXParticlePool {
  private pool: VFXParticle[] = [];
  private activeCount = 0;
  private config: PoolConfig;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Initialize pool with inactive particles.
   */
  private initialize(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      this.pool.push(this.createParticle());
    }
  }

  /**
   * Create a new inactive particle.
   */
  private createParticle(): VFXParticle {
    return {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 4,
      color: '#ffffff',
    };
  }

  /**
   * Acquire a particle from the pool.
   * Returns null if pool is at max capacity.
   */
  acquire(): VFXParticle | null {
    // Find an inactive particle
    for (const particle of this.pool) {
      if (!particle.active) {
        particle.active = true;
        this.activeCount++;
        return particle;
      }
    }

    // Pool exhausted - try to grow
    if (this.pool.length < this.config.maxSize) {
      const growthCount = Math.min(
        this.config.growthSize,
        this.config.maxSize - this.pool.length
      );

      for (let i = 0; i < growthCount; i++) {
        this.pool.push(this.createParticle());
      }

      // Try again
      const particle = this.pool[this.pool.length - growthCount];
      if (particle && !particle.active) {
        particle.active = true;
        this.activeCount++;
        return particle;
      }
    }

    // At max capacity
    return null;
  }

  /**
   * Release a particle back to the pool.
   */
  release(particle: VFXParticle): void {
    if (particle.active) {
      particle.active = false;
      this.activeCount--;

      // Reset optional properties
      particle.rotation = undefined;
      particle.rotationSpeed = undefined;
      particle.scale = undefined;
      particle.alpha = undefined;
      particle.gravity = undefined;
      particle.friction = undefined;
      particle.effectType = undefined;
      particle.colorSecondary = undefined;
      particle.glowIntensity = undefined;
      particle.trailLength = undefined;
      particle.trailPositions = undefined;
    }
  }

  /**
   * Get all active particles.
   */
  getActiveParticles(): VFXParticle[] {
    return this.pool.filter((p) => p.active);
  }

  /**
   * Iterate over active particles (more efficient than getActiveParticles).
   */
  forEachActive(callback: (particle: VFXParticle) => void): void {
    for (const particle of this.pool) {
      if (particle.active) {
        callback(particle);
      }
    }
  }

  /**
   * Update all active particles.
   * Returns the callback for each particle, which should return false to release.
   */
  updateAll(
    dt: number,
    updateFn: (particle: VFXParticle, dt: number) => boolean
  ): void {
    for (const particle of this.pool) {
      if (particle.active) {
        const keepAlive = updateFn(particle, dt);
        if (!keepAlive) {
          this.release(particle);
        }
      }
    }
  }

  /**
   * Release all active particles.
   */
  releaseAll(): void {
    for (const particle of this.pool) {
      if (particle.active) {
        this.release(particle);
      }
    }
  }

  /**
   * Get current stats.
   */
  getStats(): { active: number; total: number; maxSize: number } {
    return {
      active: this.activeCount,
      total: this.pool.length,
      maxSize: this.config.maxSize,
    };
  }
}

/**
 * Global particle pool singleton.
 */
let globalPool: VFXParticlePool | null = null;

export function getGlobalParticlePool(): VFXParticlePool {
  if (!globalPool) {
    globalPool = new VFXParticlePool({
      initialSize: 300,
      maxSize: 500,
      growthSize: 50,
    });
  }
  return globalPool;
}
