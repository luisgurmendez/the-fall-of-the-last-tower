/**
 * ServerGameContext - Manages all game state on the server.
 *
 * This is the authoritative source of truth for the game.
 * All entities, their positions, health, abilities, etc. are managed here.
 */

import {
  Vector,
  MOBAConfig,
  Side,
  EntityType,
  EntitySnapshot,
  GameEvent,
  GameEventType,
} from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';

export interface GameContextConfig {
  gameId: string;
  mapConfig?: typeof MOBAConfig;
}

export class ServerGameContext {
  readonly gameId: string;
  readonly mapConfig: typeof MOBAConfig;

  // Entity management
  private entities: Map<string, ServerEntity> = new Map();
  private champions: Map<string, ServerChampion> = new Map();
  private entityIdCounter = 0;

  // Player management
  private playerChampions: Map<string, string> = new Map(); // playerId -> championEntityId

  // Game state
  private gameTime = 0;
  private tick = 0;

  // Events for broadcasting
  private pendingEvents: GameEvent[] = [];

  // Spawn counters
  private minionWaveCount = 0;
  private nextMinionWaveTime = MOBAConfig.MINION_WAVES.FIRST_WAVE_DELAY;

  constructor(config: GameContextConfig) {
    this.gameId = config.gameId;
    this.mapConfig = config.mapConfig ?? MOBAConfig;
  }

  /**
   * Generate a unique entity ID.
   */
  generateEntityId(): string {
    return `${this.gameId}_e${++this.entityIdCounter}`;
  }

  /**
   * Add an entity to the game.
   */
  addEntity(entity: ServerEntity): void {
    this.entities.set(entity.id, entity);
  }

  /**
   * Remove an entity from the game.
   */
  removeEntity(entityId: string): void {
    this.entities.delete(entityId);
    this.champions.delete(entityId);
  }

  /**
   * Get an entity by ID.
   */
  getEntity(entityId: string): ServerEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get all entities.
   */
  getAllEntities(): ServerEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Add a champion to the game.
   */
  addChampion(champion: ServerChampion, playerId: string): void {
    this.entities.set(champion.id, champion);
    this.champions.set(champion.id, champion);
    this.playerChampions.set(playerId, champion.id);
  }

  /**
   * Get a champion by ID.
   */
  getChampion(entityId: string): ServerChampion | undefined {
    return this.champions.get(entityId);
  }

  /**
   * Get champion by player ID.
   */
  getChampionByPlayerId(playerId: string): ServerChampion | undefined {
    const entityId = this.playerChampions.get(playerId);
    return entityId ? this.champions.get(entityId) : undefined;
  }

  /**
   * Get all champions.
   */
  getAllChampions(): ServerChampion[] {
    return Array.from(this.champions.values());
  }

  /**
   * Get champions by team.
   */
  getChampionsBySide(side: Side): ServerChampion[] {
    return Array.from(this.champions.values()).filter(c => c.side === side);
  }

  /**
   * Update game state for one tick.
   */
  update(dt: number): void {
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
  private checkMinionWaveSpawn(): void {
    if (this.gameTime >= this.nextMinionWaveTime) {
      this.spawnMinionWave();
      this.minionWaveCount++;
      this.nextMinionWaveTime += this.mapConfig.MINION_WAVES.SPAWN_INTERVAL;
    }
  }

  /**
   * Spawn a minion wave for both teams.
   */
  private spawnMinionWave(): void {
    // TODO: Implement minion spawning
    console.log(`[ServerGameContext] Spawning minion wave ${this.minionWaveCount + 1}`);
  }

  /**
   * Add a game event.
   */
  addEvent(type: GameEventType, data: Record<string, unknown>): void {
    this.pendingEvents.push({
      type,
      timestamp: this.gameTime,
      data,
    });
  }

  /**
   * Get and clear pending events.
   */
  flushEvents(): GameEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  /**
   * Get entities visible to a specific side (fog of war filtering).
   */
  getVisibleEntities(forSide: Side): ServerEntity[] {
    // TODO: Implement fog of war visibility
    // For now, return all entities
    return Array.from(this.entities.values());
  }

  /**
   * Get entities within a radius of a position.
   */
  getEntitiesInRadius(position: Vector, radius: number): ServerEntity[] {
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
  getEnemiesInRadius(position: Vector, radius: number, side: Side): ServerEntity[] {
    return this.getEntitiesInRadius(position, radius).filter(
      entity => 'side' in entity && (entity as { side: Side }).side !== side
    );
  }

  /**
   * Get current game time in seconds.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Get current tick.
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * Create a full state snapshot for a player.
   */
  createSnapshot(forPlayerId: string): EntitySnapshot[] {
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
  createDeltaUpdates(forPlayerId: string, lastAckedTick: number): EntitySnapshot[] {
    // TODO: Track entity changes and only send deltas
    // For now, send full snapshots
    return this.createSnapshot(forPlayerId);
  }
}
