/**
 * ServerGameContext - Manages all game state on the server.
 *
 * This is the authoritative source of truth for the game.
 * All entities, their positions, health, abilities, etc. are managed here.
 */
import { MOBAConfig, } from '@siege/shared';
export class ServerGameContext {
    constructor(config) {
        // Entity management
        this.entities = new Map();
        this.champions = new Map();
        this.entityIdCounter = 0;
        // Player management
        this.playerChampions = new Map(); // playerId -> championEntityId
        // Game state
        this.gameTime = 0;
        this.tick = 0;
        // Events for broadcasting
        this.pendingEvents = [];
        // Spawn counters
        this.minionWaveCount = 0;
        this.nextMinionWaveTime = MOBAConfig.MINION_WAVES.FIRST_WAVE_DELAY;
        this.gameId = config.gameId;
        this.mapConfig = config.mapConfig ?? MOBAConfig;
    }
    /**
     * Generate a unique entity ID.
     */
    generateEntityId() {
        return `${this.gameId}_e${++this.entityIdCounter}`;
    }
    /**
     * Add an entity to the game.
     */
    addEntity(entity) {
        this.entities.set(entity.id, entity);
    }
    /**
     * Remove an entity from the game.
     */
    removeEntity(entityId) {
        this.entities.delete(entityId);
        this.champions.delete(entityId);
    }
    /**
     * Get an entity by ID.
     */
    getEntity(entityId) {
        return this.entities.get(entityId);
    }
    /**
     * Get all entities.
     */
    getAllEntities() {
        return Array.from(this.entities.values());
    }
    /**
     * Add a champion to the game.
     */
    addChampion(champion, playerId) {
        this.entities.set(champion.id, champion);
        this.champions.set(champion.id, champion);
        this.playerChampions.set(playerId, champion.id);
    }
    /**
     * Get a champion by ID.
     */
    getChampion(entityId) {
        return this.champions.get(entityId);
    }
    /**
     * Get champion by player ID.
     */
    getChampionByPlayerId(playerId) {
        const entityId = this.playerChampions.get(playerId);
        return entityId ? this.champions.get(entityId) : undefined;
    }
    /**
     * Get all champions.
     */
    getAllChampions() {
        return Array.from(this.champions.values());
    }
    /**
     * Get champions by team.
     */
    getChampionsBySide(side) {
        return Array.from(this.champions.values()).filter(c => c.side === side);
    }
    /**
     * Update game state for one tick.
     */
    update(dt) {
        this.tick++;
        this.gameTime += dt;
        // Update all entities
        for (const entity of this.entities.values()) {
            entity.update(dt, this);
        }
        // Check for minion wave spawns
        this.checkMinionWaveSpawn();
        // Remove dead entities marked for removal
        for (const [id, entity] of this.entities) {
            if (entity.shouldRemove()) {
                this.removeEntity(id);
            }
        }
    }
    /**
     * Check if it's time to spawn a minion wave.
     */
    checkMinionWaveSpawn() {
        if (this.gameTime >= this.nextMinionWaveTime) {
            this.spawnMinionWave();
            this.minionWaveCount++;
            this.nextMinionWaveTime += this.mapConfig.MINION_WAVES.SPAWN_INTERVAL;
        }
    }
    /**
     * Spawn a minion wave for both teams.
     */
    spawnMinionWave() {
        // TODO: Implement minion spawning
        console.log(`[ServerGameContext] Spawning minion wave ${this.minionWaveCount + 1}`);
    }
    /**
     * Add a game event.
     */
    addEvent(type, data) {
        this.pendingEvents.push({
            type,
            timestamp: this.gameTime,
            data,
        });
    }
    /**
     * Get and clear pending events.
     */
    flushEvents() {
        const events = this.pendingEvents;
        this.pendingEvents = [];
        return events;
    }
    /**
     * Get entities visible to a specific side (fog of war filtering).
     */
    getVisibleEntities(forSide) {
        // TODO: Implement fog of war visibility
        // For now, return all entities
        return Array.from(this.entities.values());
    }
    /**
     * Get entities within a radius of a position.
     */
    getEntitiesInRadius(position, radius) {
        const radiusSq = radius * radius;
        return Array.from(this.entities.values()).filter(entity => {
            const dx = entity.position.x - position.x;
            const dy = entity.position.y - position.y;
            return dx * dx + dy * dy <= radiusSq;
        });
    }
    /**
     * Get enemies within a radius of a position.
     */
    getEnemiesInRadius(position, radius, side) {
        return this.getEntitiesInRadius(position, radius).filter(entity => 'side' in entity && entity.side !== side);
    }
    /**
     * Get current game time in seconds.
     */
    getGameTime() {
        return this.gameTime;
    }
    /**
     * Get current tick.
     */
    getTick() {
        return this.tick;
    }
    /**
     * Create a full state snapshot for a player.
     */
    createSnapshot(forPlayerId) {
        const playerChampion = this.getChampionByPlayerId(forPlayerId);
        const side = playerChampion?.side ?? 0;
        // Get visible entities (fog of war)
        const visibleEntities = this.getVisibleEntities(side);
        // Create snapshots
        return visibleEntities.map(entity => entity.toSnapshot());
    }
    /**
     * Create delta updates (only changed entities).
     */
    createDeltaUpdates(forPlayerId, lastAckedTick) {
        // TODO: Track entity changes and only send deltas
        // For now, send full snapshots
        return this.createSnapshot(forPlayerId);
    }
}
//# sourceMappingURL=ServerGameContext.js.map