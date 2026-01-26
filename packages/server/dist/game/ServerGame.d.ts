/**
 * ServerGame - Main game loop running at 125 Hz (8ms tick).
 *
 * Handles:
 * - Fixed timestep game simulation
 * - Entity updates
 * - Input processing
 * - State broadcasting
 */
export interface ServerGameConfig {
    tickRate?: number;
    onTick?: (tick: number, dt: number) => void;
    onStateUpdate?: (tick: number) => void;
}
export declare class ServerGame {
    private tick;
    private running;
    private tickInterval;
    private readonly tickRate;
    private readonly tickMs;
    private readonly onTick?;
    private readonly onStateUpdate?;
    private lastTickTime;
    private tickDurations;
    private allTickDurations;
    private maxTickDuration;
    private minTickDuration;
    private budgetOverruns;
    private totalTickDuration;
    private lastTickStart;
    private tickIntervals;
    private memorySnapshots;
    private lastMemorySample;
    private readonly memorySampleInterval;
    constructor(config?: ServerGameConfig);
    /**
     * Start the game loop.
     */
    start(): void;
    /**
     * Stop the game loop.
     */
    stop(): void;
    /**
     * Process a single game tick.
     */
    private processTick;
    /**
     * Track tick duration for performance monitoring.
     */
    private trackTickDuration;
    /**
     * Sample current memory usage.
     */
    private sampleMemory;
    /**
     * Calculate percentile from sorted array.
     */
    private percentile;
    /**
     * Calculate standard deviation.
     */
    private standardDeviation;
    /**
     * Format bytes to human readable string.
     */
    private formatBytes;
    /**
     * Log performance metrics in a detailed table format.
     */
    private logMetrics;
    /**
     * Get current tick number.
     */
    getCurrentTick(): number;
    /**
     * Get tick rate.
     */
    getTickRate(): number;
    /**
     * Check if game is running.
     */
    isRunning(): boolean;
    /**
     * Get game time in seconds.
     */
    getGameTime(): number;
    /**
     * Get metrics as an object for external monitoring/APIs.
     */
    getMetrics(): ServerGameMetrics;
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
//# sourceMappingURL=ServerGame.d.ts.map