/**
 * ServerGame - Main game loop running at 125 Hz (8ms tick).
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
  private allTickDurations: number[] = []; // Keep all for percentile calculations
  private maxTickDuration = 0;
  private minTickDuration = Infinity;
  private budgetOverruns = 0;
  private totalTickDuration = 0;

  // Tick interval jitter tracking
  private lastTickStart = 0;
  private tickIntervals: number[] = [];

  // Memory tracking (sampled periodically)
  private memorySnapshots: number[] = [];
  private lastMemorySample = 0;
  private readonly memorySampleInterval = 1000; // Sample memory every 1 second

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

    // Track tick interval jitter
    if (this.lastTickStart > 0) {
      const interval = startTime - this.lastTickStart;
      this.tickIntervals.push(interval);
      if (this.tickIntervals.length > 100) {
        this.tickIntervals.shift();
      }
    }
    this.lastTickStart = startTime;

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

    // Sample memory periodically
    if (startTime - this.lastMemorySample >= this.memorySampleInterval) {
      this.sampleMemory();
      this.lastMemorySample = startTime;
    }
  }

  /**
   * Track tick duration for performance monitoring.
   */
  private trackTickDuration(duration: number): void {
    // Rolling window for recent average
    this.tickDurations.push(duration);
    if (this.tickDurations.length > 100) {
      this.tickDurations.shift();
    }

    // Keep all durations for percentile calculations (capped at 10000)
    this.allTickDurations.push(duration);
    if (this.allTickDurations.length > 10000) {
      this.allTickDurations.shift();
    }

    // Track totals
    this.totalTickDuration += duration;

    // Track min/max
    if (duration > this.maxTickDuration) {
      this.maxTickDuration = duration;
    }
    if (duration < this.minTickDuration) {
      this.minTickDuration = duration;
    }

    // Track budget overruns
    if (duration > this.tickMs) {
      this.budgetOverruns++;
    }

    // Warn if tick is taking too long
    if (duration > this.tickMs * 0.8) {
      console.warn(
        `[ServerGame] Tick ${this.tick} took ${duration}ms (budget: ${this.tickMs}ms)`
      );
    }
  }

  /**
   * Sample current memory usage.
   */
  private sampleMemory(): void {
    try {
      // Works in Bun and Node.js
      const memUsage = process.memoryUsage();
      this.memorySnapshots.push(memUsage.heapUsed);
      if (this.memorySnapshots.length > 60) {
        // Keep last 60 samples (1 minute at 1 sample/sec)
        this.memorySnapshots.shift();
      }
    } catch {
      // Memory sampling not available
    }
  }

  /**
   * Calculate percentile from sorted array.
   */
  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }

  /**
   * Calculate standard deviation.
   */
  private standardDeviation(arr: number[], mean: number): number {
    if (arr.length === 0) return 0;
    const squaredDiffs = arr.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Format bytes to human readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Log performance metrics.
   */
  private logMetrics(): void {
    if (this.allTickDurations.length === 0) return;

    // Calculate tick duration stats
    const sorted = [...this.allTickDurations].sort((a, b) => a - b);
    const avg = this.totalTickDuration / this.tick;
    const median = this.percentile(sorted, 50);
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);
    const stdDev = this.standardDeviation(this.allTickDurations, avg);

    // Calculate jitter stats
    let avgJitter = 0;
    let maxJitter = 0;
    if (this.tickIntervals.length > 0) {
      const jitters = this.tickIntervals.map((interval) =>
        Math.abs(interval - this.tickMs)
      );
      avgJitter = jitters.reduce((a, b) => a + b, 0) / jitters.length;
      maxJitter = Math.max(...jitters);
    }

    // Calculate memory stats
    let memoryStats = '';
    if (this.memorySnapshots.length > 0) {
      const avgMem =
        this.memorySnapshots.reduce((a, b) => a + b, 0) / this.memorySnapshots.length;
      const maxMem = Math.max(...this.memorySnapshots);
      const minMem = Math.min(...this.memorySnapshots);
      memoryStats = `
  Memory:
    - Current heap: ${this.formatBytes(this.memorySnapshots[this.memorySnapshots.length - 1])}
    - Avg heap: ${this.formatBytes(avgMem)}
    - Min heap: ${this.formatBytes(minMem)}
    - Max heap: ${this.formatBytes(maxMem)}`;
    }

    const gameTimeSeconds = this.tick / this.tickRate;
    const minutes = Math.floor(gameTimeSeconds / 60);
    const seconds = (gameTimeSeconds % 60).toFixed(1);

    console.log(`[ServerGame] Metrics:
  General:
    - Game duration: ${minutes}m ${seconds}s
    - Ticks processed: ${this.tick}
    - Budget per tick: ${this.tickMs.toFixed(2)}ms

  Tick Duration:
    - Min: ${this.minTickDuration === Infinity ? 0 : this.minTickDuration}ms
    - Avg: ${avg.toFixed(2)}ms
    - Median: ${median}ms
    - Max: ${this.maxTickDuration}ms
    - Std Dev: ${stdDev.toFixed(2)}ms
    - P95: ${p95}ms
    - P99: ${p99}ms

  Budget:
    - Overruns: ${this.budgetOverruns} (${((this.budgetOverruns / this.tick) * 100).toFixed(2)}%)
    - Avg utilization: ${((avg / this.tickMs) * 100).toFixed(1)}%

  Timing Jitter:
    - Avg jitter: ${avgJitter.toFixed(2)}ms
    - Max jitter: ${maxJitter.toFixed(2)}ms${memoryStats}`);
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

  /**
   * Get metrics as an object for external monitoring/APIs.
   */
  getMetrics(): ServerGameMetrics {
    const sorted = [...this.allTickDurations].sort((a, b) => a - b);
    const avg = this.tick > 0 ? this.totalTickDuration / this.tick : 0;

    let avgJitter = 0;
    let maxJitter = 0;
    if (this.tickIntervals.length > 0) {
      const jitters = this.tickIntervals.map((interval) =>
        Math.abs(interval - this.tickMs)
      );
      avgJitter = jitters.reduce((a, b) => a + b, 0) / jitters.length;
      maxJitter = Math.max(...jitters);
    }

    const currentHeap = this.memorySnapshots.length > 0
      ? this.memorySnapshots[this.memorySnapshots.length - 1]
      : 0;

    return {
      gameTimeSeconds: this.tick / this.tickRate,
      ticksProcessed: this.tick,
      tickBudgetMs: this.tickMs,
      tickDuration: {
        min: this.minTickDuration === Infinity ? 0 : this.minTickDuration,
        avg,
        median: this.percentile(sorted, 50),
        max: this.maxTickDuration,
        stdDev: this.standardDeviation(this.allTickDurations, avg),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99),
      },
      budget: {
        overruns: this.budgetOverruns,
        overrunPercent: this.tick > 0 ? (this.budgetOverruns / this.tick) * 100 : 0,
        utilizationPercent: this.tickMs > 0 ? (avg / this.tickMs) * 100 : 0,
      },
      jitter: {
        avg: avgJitter,
        max: maxJitter,
      },
      memory: {
        currentHeapBytes: currentHeap,
        avgHeapBytes: this.memorySnapshots.length > 0
          ? this.memorySnapshots.reduce((a, b) => a + b, 0) / this.memorySnapshots.length
          : 0,
        maxHeapBytes: this.memorySnapshots.length > 0 ? Math.max(...this.memorySnapshots) : 0,
      },
    };
  }
}

/**
 * Metrics object returned by getMetrics().
 */
export interface ServerGameMetrics {
  gameTimeSeconds: number;
  ticksProcessed: number;
  tickBudgetMs: number;
  tickDuration: {
    min: number;
    avg: number;
    median: number;
    max: number;
    stdDev: number;
    p95: number;
    p99: number;
  };
  budget: {
    overruns: number;
    overrunPercent: number;
    utilizationPercent: number;
  };
  jitter: {
    avg: number;
    max: number;
  };
  memory: {
    currentHeapBytes: number;
    avgHeapBytes: number;
    maxHeapBytes: number;
  };
}
