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
export class ServerGame {
    constructor(config = {}) {
        this.tick = 0;
        this.running = false;
        this.tickInterval = null;
        // Timing metrics
        this.lastTickTime = 0;
        this.tickDurations = [];
        this.allTickDurations = []; // Keep all for percentile calculations
        this.maxTickDuration = 0;
        this.minTickDuration = Infinity;
        this.budgetOverruns = 0;
        this.totalTickDuration = 0;
        // Tick interval jitter tracking
        this.lastTickStart = 0;
        this.tickIntervals = [];
        // Memory tracking (sampled periodically)
        this.memorySnapshots = [];
        this.lastMemorySample = 0;
        this.memorySampleInterval = 1000; // Sample memory every 1 second
        this.tickRate = config.tickRate ?? GameConfig.TICK.SERVER_TICK_RATE;
        this.tickMs = 1000 / this.tickRate;
        this.onTick = config.onTick;
        this.onStateUpdate = config.onStateUpdate;
    }
    /**
     * Start the game loop.
     */
    start() {
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
    stop() {
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
    processTick() {
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
        }
        catch (error) {
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
    trackTickDuration(duration) {
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
            console.warn(`[ServerGame] Tick ${this.tick} took ${duration}ms (budget: ${this.tickMs}ms)`);
        }
    }
    /**
     * Sample current memory usage.
     */
    sampleMemory() {
        try {
            // Works in Bun and Node.js
            const memUsage = process.memoryUsage();
            this.memorySnapshots.push(memUsage.heapUsed);
            if (this.memorySnapshots.length > 60) {
                // Keep last 60 samples (1 minute at 1 sample/sec)
                this.memorySnapshots.shift();
            }
        }
        catch {
            // Memory sampling not available
        }
    }
    /**
     * Calculate percentile from sorted array.
     */
    percentile(sortedArr, p) {
        if (sortedArr.length === 0)
            return 0;
        const index = Math.ceil((p / 100) * sortedArr.length) - 1;
        return sortedArr[Math.max(0, index)];
    }
    /**
     * Calculate standard deviation.
     */
    standardDeviation(arr, mean) {
        if (arr.length === 0)
            return 0;
        const squaredDiffs = arr.map((value) => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(avgSquaredDiff);
    }
    /**
     * Format bytes to human readable string.
     */
    formatBytes(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    /**
     * Log performance metrics.
     */
    logMetrics() {
        if (this.allTickDurations.length === 0)
            return;
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
            const jitters = this.tickIntervals.map((interval) => Math.abs(interval - this.tickMs));
            avgJitter = jitters.reduce((a, b) => a + b, 0) / jitters.length;
            maxJitter = Math.max(...jitters);
        }
        // Calculate memory stats
        let memoryStats = '';
        if (this.memorySnapshots.length > 0) {
            const avgMem = this.memorySnapshots.reduce((a, b) => a + b, 0) / this.memorySnapshots.length;
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
    getCurrentTick() {
        return this.tick;
    }
    /**
     * Get tick rate.
     */
    getTickRate() {
        return this.tickRate;
    }
    /**
     * Check if game is running.
     */
    isRunning() {
        return this.running;
    }
    /**
     * Get game time in seconds.
     */
    getGameTime() {
        return this.tick / this.tickRate;
    }
    /**
     * Get metrics as an object for external monitoring/APIs.
     */
    getMetrics() {
        const sorted = [...this.allTickDurations].sort((a, b) => a - b);
        const avg = this.tick > 0 ? this.totalTickDuration / this.tick : 0;
        let avgJitter = 0;
        let maxJitter = 0;
        if (this.tickIntervals.length > 0) {
            const jitters = this.tickIntervals.map((interval) => Math.abs(interval - this.tickMs));
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
//# sourceMappingURL=ServerGame.js.map