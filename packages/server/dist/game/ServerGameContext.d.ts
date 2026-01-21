/**
 * ServerGameContext - Manages all game state on the server.
 *
 * This is the authoritative source of truth for the game.
 * All entities, their positions, health, abilities, etc. are managed here.
 */
import { Vector, MOBAConfig, Side, EntitySnapshot, GameEvent, GameEventType, type WardType } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import { ServerWard } from '../simulation/ServerWard';
import { FogOfWarServer } from '../systems/FogOfWarServer';
export interface GameContextConfig {
    gameId: string;
    mapConfig?: typeof MOBAConfig;
}
export declare class ServerGameContext {
    readonly gameId: string;
    readonly mapConfig: typeof MOBAConfig;
    private entities;
    private champions;
    private entityIdCounter;
    private playerChampions;
    private gameTime;
    private tick;
    private pendingEvents;
    private minionWaveCount;
    private nextMinionWaveTime;
    private fogOfWar;
    private collisionSystem;
    private jungleCamps;
    private wards;
    private readonly MAX_WARDS_PER_PLAYER;
    constructor(config: GameContextConfig);
    /**
     * Initialize jungle camps from config.
     */
    private initializeJungleCamps;
    /**
     * Spawn all jungle camps (called at game start).
     */
    spawnJungleCamps(): void;
    /**
     * Generate a unique entity ID.
     */
    generateEntityId(): string;
    /**
     * Add an entity to the game.
     */
    addEntity(entity: ServerEntity): void;
    /**
     * Remove an entity from the game.
     */
    removeEntity(entityId: string): void;
    /**
     * Get an entity by ID.
     */
    getEntity(entityId: string): ServerEntity | undefined;
    /**
     * Get all entities.
     */
    getAllEntities(): ServerEntity[];
    /**
     * Add a champion to the game.
     */
    addChampion(champion: ServerChampion, playerId: string): void;
    /**
     * Get a champion by ID.
     */
    getChampion(entityId: string): ServerChampion | undefined;
    /**
     * Get champion by player ID.
     */
    getChampionByPlayerId(playerId: string): ServerChampion | undefined;
    /**
     * Get all champions.
     */
    getAllChampions(): ServerChampion[];
    /**
     * Get champions by team.
     */
    getChampionsBySide(side: Side): ServerChampion[];
    /**
     * Place a ward at a position.
     * Returns true if ward was placed, false if player has too many wards.
     */
    placeWard(playerId: string, wardType: WardType, position: Vector): ServerWard | null;
    /**
     * Remove a ward by ID.
     */
    removeWard(wardId: string): void;
    /**
     * Get all wards.
     */
    getWards(): ServerWard[];
    /**
     * Get wards owned by a player.
     */
    getWardsByOwner(playerId: string): ServerWard[];
    /**
     * Get wards for a side.
     */
    getWardsBySide(side: Side): ServerWard[];
    /**
     * Update game state for one tick.
     */
    update(dt: number): void;
    /**
     * Check if it's time to spawn a minion wave.
     */
    private checkMinionWaveSpawn;
    /**
     * Spawn a minion wave for both teams.
     */
    private spawnMinionWave;
    /**
     * Spawn minions for a specific side and lane.
     * Minions are spawned in a staggered line formation to prevent clumping.
     */
    private spawnLaneMinions;
    /**
     * Add a game event.
     */
    addEvent(type: GameEventType, data: Record<string, unknown>): void;
    /**
     * Get and clear pending events.
     */
    flushEvents(): GameEvent[];
    /**
     * Get entities visible to a specific side (fog of war filtering).
     */
    getVisibleEntities(forSide: Side): ServerEntity[];
    /**
     * Check if an entity is visible to a side.
     */
    isEntityVisibleTo(entity: ServerEntity, side: Side): boolean;
    /**
     * Check if a position is visible to a side.
     */
    isPositionVisibleTo(position: Vector, side: Side): boolean;
    /**
     * Check if source can target the target (visibility check).
     */
    canTarget(source: ServerEntity, target: ServerEntity): boolean;
    /**
     * Get the fog of war system.
     */
    getFogOfWar(): FogOfWarServer;
    /**
     * Get entities within a radius of a position.
     */
    getEntitiesInRadius(position: Vector, radius: number): ServerEntity[];
    /**
     * Get enemies within a radius of a position.
     */
    getEnemiesInRadius(position: Vector, radius: number, side: Side): ServerEntity[];
    /**
     * Get current game time in seconds.
     */
    getGameTime(): number;
    /**
     * Get current tick.
     */
    getTick(): number;
    /**
     * Create a full state snapshot for a player.
     */
    createSnapshot(forPlayerId: string): EntitySnapshot[];
    /**
     * Create delta updates (only changed entities).
     */
    createDeltaUpdates(forPlayerId: string, lastAckedTick: number): EntitySnapshot[];
}
//# sourceMappingURL=ServerGameContext.d.ts.map