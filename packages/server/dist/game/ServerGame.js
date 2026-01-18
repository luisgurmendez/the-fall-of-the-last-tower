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
export class ServerGame {
    constructor(config = {}) {
        this.tick = 0;
        this.running = false;
        this.tickInterval = null;
        // Timing metrics
        this.lastTickTime = 0;
        this.tickDurations = [];
        this.maxTickDuration = 0;
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
    }
    /**
     * Track tick duration for performance monitoring.
     */
    trackTickDuration(duration) {
        this.tickDurations.push(duration);
        if (this.tickDurations.length > 100) {
            this.tickDurations.shift();
        }
        if (duration > this.maxTickDuration) {
            this.maxTickDuration = duration;
        }
        // Warn if tick is taking too long
        if (duration > this.tickMs * 0.8) {
            console.warn(`[ServerGame] Tick ${this.tick} took ${duration}ms (budget: ${this.tickMs}ms)`);
        }
    }
    /**
     * Log performance metrics.
     */
    logMetrics() {
        if (this.tickDurations.length === 0)
            return;
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
}
//# sourceMappingURL=ServerGame.js.map