/**
 * ServerGame - Main game loop running at 30 Hz.
 *
 * Handles:
 * - Fixed timestep game simulation
 * - Entity updates
 * - Input processing
 * - State broadcasting
 */

import { GameConfig } from '@siege/shared';

export interface ServerGameConfig {
  tickRate?: number;
  onTick?: (tick: number, dt: number) => void;
  onStateUpdate?: (tick: number) => void;
}

export class ServerGame {
  private tick = 0;
  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  private readonly tickRate: number;
  private readonly tickMs: number;
  private readonly onTick?: (tick: number, dt: number) => void;
  private readonly onStateUpdate?: (tick: number) => void;

  // Timing metrics
  private lastTickTime = 0;
  private tickDurations: number[] = [];
  private maxTickDuration = 0;

  constructor(config: ServerGameConfig = {}) {
    this.tickRate = config.tickRate ?? GameConfig.TICK.SERVER_TICK_RATE;
    this.tickMs = 1000 / this.tickRate;
    this.onTick = config.onTick;
    this.onStateUpdate = config.onStateUpdate;
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (this.running) {
      console.warn('ServerGame is already running');
      return;
    }

    this.running = true;
    this.tick = 0;
    this.lastTickTime = Date.now();

    console.log(`[ServerGame] Starting at ${this.tickRate} Hz (${this.tickMs.toFixed(2)}ms per tick)`);

    // Use setInterval for consistent timing
    // In production, consider using a more precise timer
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, this.tickMs);
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    console.log(`[ServerGame] Stopped at tick ${this.tick}`);
    this.logMetrics();
  }

  /**
   * Process a single game tick.
   */
  private processTick(): void {
    const startTime = Date.now();
    const dt = this.tickMs / 1000; // Delta time in seconds

    try {
      // 1. Process pending inputs (done by GameRoom before tick)
      // 2. Update game simulation
      this.onTick?.(this.tick, dt);

      // 3. Broadcast state updates
      this.onStateUpdate?.(this.tick);

      this.tick++;
    } catch (error) {
      console.error(`[ServerGame] Error in tick ${this.tick}:`, error);
    }

    // Track timing
    const duration = Date.now() - startTime;
    this.trackTickDuration(duration);
  }

  /**
   * Track tick duration for performance monitoring.
   */
  private trackTickDuration(duration: number): void {
    this.tickDurations.push(duration);
    if (this.tickDurations.length > 100) {
      this.tickDurations.shift();
    }

    if (duration > this.maxTickDuration) {
      this.maxTickDuration = duration;
    }

    // Warn if tick is taking too long
    if (duration > this.tickMs * 0.8) {
      console.warn(
        `[ServerGame] Tick ${this.tick} took ${duration}ms (budget: ${this.tickMs}ms)`
      );
    }
  }

  /**
   * Log performance metrics.
   */
  private logMetrics(): void {
    if (this.tickDurations.length === 0) return;

    const avg = this.tickDurations.reduce((a, b) => a + b, 0) / this.tickDurations.length;
    console.log(`[ServerGame] Metrics:`);
    console.log(`  - Ticks processed: ${this.tick}`);
    console.log(`  - Avg tick duration: ${avg.toFixed(2)}ms`);
    console.log(`  - Max tick duration: ${this.maxTickDuration}ms`);
    console.log(`  - Budget per tick: ${this.tickMs.toFixed(2)}ms`);
  }

  /**
   * Get current tick number.
   */
  getCurrentTick(): number {
    return this.tick;
  }

  /**
   * Get tick rate.
   */
  getTickRate(): number {
    return this.tickRate;
  }

  /**
   * Check if game is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get game time in seconds.
   */
  getGameTime(): number {
    return this.tick / this.tickRate;
  }
}
