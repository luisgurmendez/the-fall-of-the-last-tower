/**
 * ServerGameContext - Manages all game state on the server.
 *
 * This is the authoritative source of truth for the game.
 * All entities, their positions, health, abilities, etc. are managed here.
 */
import { Vector, MOBAConfig, } from '@siege/shared';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerJungleCamp } from '../simulation/ServerJungleCamp';
import { ServerWard } from '../simulation/ServerWard';
import { FogOfWarServer } from '../systems/FogOfWarServer';
import { CollisionSystem } from '../systems/CollisionSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { Logger } from '../utils/Logger';
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
        // Jungle camps
        this.jungleCamps = [];
        // Ward management
        this.wards = new Map();
        this.MAX_WARDS_PER_PLAYER = 3; // Max wards a player can have active
        this.gameId = config.gameId;
        this.mapConfig = config.mapConfig ?? MOBAConfig;
        this.fogOfWar = new FogOfWarServer();
        this.collisionSystem = new CollisionSystem();
        // Initialize jungle camps
        this.initializeJungleCamps();
    }
    /**
     * Initialize jungle camps from config.
     */
    initializeJungleCamps() {
        for (const campConfig of this.mapConfig.JUNGLE.CAMPS) {
            const camp = new ServerJungleCamp({
                id: campConfig.id,
                position: new Vector(campConfig.position.x, campConfig.position.y),
                creatureType: campConfig.creatureType,
                count: campConfig.count,
                respawnTime: campConfig.respawnTime,
            });
            this.jungleCamps.push(camp);
        }
        Logger.game.debug(`Initialized ${this.jungleCamps.length} jungle camps`);
    }
    /**
     * Spawn all jungle camps (called at game start).
     */
    spawnJungleCamps() {
        for (const camp of this.jungleCamps) {
            camp.spawnCreatures(this);
        }
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
        this.wards.delete(entityId);
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
    // =====================
    // Ward Management
    // =====================
    /**
     * Place a ward at a position.
     * Returns true if ward was placed, false if player has too many wards.
     */
    placeWard(playerId, wardType, position) {
        const champion = this.getChampionByPlayerId(playerId);
        if (!champion) {
            return null;
        }
        // Count player's existing wards
        const playerWards = this.getWardsByOwner(playerId);
        if (playerWards.length >= this.MAX_WARDS_PER_PLAYER) {
            // Remove oldest ward
            const oldestWard = playerWards[0];
            this.removeWard(oldestWard.id);
        }
        // Create and add the ward
        const ward = new ServerWard({
            id: this.generateEntityId(),
            position: position.clone(),
            side: champion.side,
            wardType,
            ownerId: playerId,
        });
        this.wards.set(ward.id, ward);
        this.entities.set(ward.id, ward);
        return ward;
    }
    /**
     * Remove a ward by ID.
     */
    removeWard(wardId) {
        const ward = this.wards.get(wardId);
        if (ward) {
            this.wards.delete(wardId);
            this.entities.delete(wardId);
        }
    }
    /**
     * Get all wards.
     */
    getWards() {
        return Array.from(this.wards.values());
    }
    /**
     * Get wards owned by a player.
     */
    getWardsByOwner(playerId) {
        return Array.from(this.wards.values())
            .filter(w => w.ownerId === playerId && !w.isDead)
            .sort((a, b) => a.placedAt - b.placedAt);
    }
    /**
     * Get wards for a side.
     */
    getWardsBySide(side) {
        return Array.from(this.wards.values()).filter(w => w.side === side && !w.isDead);
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
        // Process passive abilities (auras, interval effects)
        const allChampions = Array.from(this.champions.values());
        passiveTriggerSystem.processAlwaysPassives(dt, allChampions, this);
        passiveTriggerSystem.processIntervalPassives(dt, allChampions, this);
        // Resolve collisions (after movement, before fog of war)
        this.collisionSystem.resolveCollisions(this.getAllEntities());
        // Update fog of war vision
        this.fogOfWar.updateVision(this, this.tick);
        // Check for minion wave spawns
        this.checkMinionWaveSpawn();
        // Update jungle camps (for respawning)
        for (const camp of this.jungleCamps) {
            camp.update(dt, this);
        }
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
        Logger.game.debug(`Minion wave ${this.minionWaveCount + 1} spawning`);
        const lanes = ['top', 'mid', 'bot'];
        const waveConfig = this.mapConfig.MINION_WAVES.WAVE_COMPOSITION;
        for (const lane of lanes) {
            // Spawn minions for both sides
            this.spawnLaneMinions(0, lane, waveConfig); // Blue side
            this.spawnLaneMinions(1, lane, waveConfig); // Red side
        }
    }
    /**
     * Spawn minions for a specific side and lane.
     * Minions are spawned in a staggered line formation to prevent clumping.
     */
    spawnLaneMinions(side, lane, waveConfig) {
        const laneConfig = this.mapConfig.LANES[lane.toUpperCase()];
        // Get waypoints - blue side uses them as-is, red side reverses them
        const waypoints = side === 0
            ? laneConfig.waypoints.map(w => new Vector(w.x, w.y))
            : [...laneConfig.waypoints].reverse().map(w => new Vector(w.x, w.y));
        // Calculate spawn position and lane direction
        const nexusPoint = waypoints[0].clone();
        const nextWaypoint = waypoints.length > 1 ? waypoints[1] : nexusPoint;
        // Calculate lane direction for staggering
        const laneDirection = new Vector(nextWaypoint.x - nexusPoint.x, nextWaypoint.y - nexusPoint.y);
        const laneDist = Math.sqrt(laneDirection.x * laneDirection.x + laneDirection.y * laneDirection.y);
        if (laneDist > 0) {
            laneDirection.x /= laneDist;
            laneDirection.y /= laneDist;
        }
        // Offset spawn position AWAY from nexus (150 units in lane direction)
        // This prevents minions from spawning inside the nexus collider
        const NEXUS_SPAWN_OFFSET = 150;
        const spawnBase = new Vector(nexusPoint.x + laneDirection.x * NEXUS_SPAWN_OFFSET, nexusPoint.y + laneDirection.y * NEXUS_SPAWN_OFFSET);
        // Perpendicular direction for spread
        const perpDirection = new Vector(-laneDirection.y, laneDirection.x);
        // Spacing between minions in the formation
        const MINION_SPACING = 60; // Distance between minions along the lane
        const LATERAL_SPREAD = 40; // Random lateral spread
        // Spawn melee minions (swordsmen) in front
        for (let i = 0; i < waveConfig.swordsmen; i++) {
            // Stagger along lane direction (front minions spawn further along the lane)
            const forwardOffset = i * MINION_SPACING;
            // Small random lateral spread
            const lateralOffset = (Math.random() - 0.5) * LATERAL_SPREAD;
            const spawnPos = new Vector(spawnBase.x + laneDirection.x * forwardOffset + perpDirection.x * lateralOffset, spawnBase.y + laneDirection.y * forwardOffset + perpDirection.y * lateralOffset);
            // Skip waypoint[0] (nexus) since we spawn minions offset from there
            // Minions should walk toward waypoint[1] immediately
            const minionWaypoints = waypoints.slice(1).map(w => w.clone());
            const minion = new ServerMinion({
                id: this.generateEntityId(),
                position: spawnPos,
                side,
                minionType: 'melee',
                lane,
                waypoints: minionWaypoints,
            });
            this.addEntity(minion);
        }
        // Spawn caster minions (archers) behind melee
        const casterStartOffset = -MINION_SPACING * 2; // Start behind the melee group
        for (let i = 0; i < waveConfig.archers; i++) {
            const forwardOffset = casterStartOffset - i * MINION_SPACING;
            const lateralOffset = (Math.random() - 0.5) * LATERAL_SPREAD;
            const spawnPos = new Vector(spawnBase.x + laneDirection.x * forwardOffset + perpDirection.x * lateralOffset, spawnBase.y + laneDirection.y * forwardOffset + perpDirection.y * lateralOffset);
            // Skip waypoint[0] (nexus) since we spawn minions offset from there
            const minionWaypoints = waypoints.slice(1).map(w => w.clone());
            const minion = new ServerMinion({
                id: this.generateEntityId(),
                position: spawnPos,
                side,
                minionType: 'caster',
                lane,
                waypoints: minionWaypoints,
            });
            this.addEntity(minion);
        }
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
        return this.fogOfWar.getVisibleEntities(this, forSide);
    }
    /**
     * Check if an entity is visible to a side.
     */
    isEntityVisibleTo(entity, side) {
        return this.fogOfWar.isVisibleTo(entity, side);
    }
    /**
     * Check if a position is visible to a side.
     */
    isPositionVisibleTo(position, side) {
        return this.fogOfWar.isPositionVisibleTo(position, side);
    }
    /**
     * Check if source can target the target (visibility check).
     */
    canTarget(source, target) {
        return this.fogOfWar.canTarget(source, target);
    }
    /**
     * Get the fog of war system.
     */
    getFogOfWar() {
        return this.fogOfWar;
    }
    /**
     * Get entities within a radius of a position.
     */
    getEntitiesInRadius(position, radius) {
        const radiusSq = radius * radius;
        return Array.from(this.entities.values()).filter(entity => {
            // Skip dead entities
            if (entity.isDead)
                return false;
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