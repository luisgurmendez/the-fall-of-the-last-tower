/**
 * ServerGame - Main game loop running at 30 Hz.
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
    private maxTickDuration;
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
     * Log performance metrics.
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
}
//# sourceMappingURL=ServerGame.d.ts.map