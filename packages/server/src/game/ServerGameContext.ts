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
  type LaneId,
  type MinionType,
  type WardType,
} from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerJungleCamp } from '../simulation/ServerJungleCamp';
import { ServerWard } from '../simulation/ServerWard';
import { FogOfWarServer } from '../systems/FogOfWarServer';
import { Terrain } from '../navigation/Terrain';
import { PathFollower } from '../navigation/PathFollower';
import { CollisionSystem } from '../systems/CollisionSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { Logger } from '../utils/Logger';

export interface GameContextConfig {
  gameId: string;
  mapConfig?: typeof MOBAConfig;
  /** Spawn minion waves on a timer (default true). Scenarios turn this off to spawn waves by hand. */
  minionWaves?: boolean;
}

export class ServerGameContext {
  readonly gameId: string;
  readonly mapConfig: typeof MOBAConfig;
  private readonly minionWavesEnabled: boolean;

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

  // Fog of war system
  private fogOfWar: FogOfWarServer;

  // Collision system
  private collisionSystem: CollisionSystem;

  // Walls and water: unit push-out and pathfinding
  readonly terrain: Terrain;
  readonly pathFollower = new PathFollower();

  // Jungle camps
  private jungleCamps: ServerJungleCamp[] = [];

  // Champions that recently damaged an enemy champion (attackerId -> victim and time)
  private championAggression: Map<string, { victimId: string; time: number }> = new Map();

  // Ward management
  private wards: Map<string, ServerWard> = new Map();
  private readonly MAX_WARDS_PER_PLAYER = 3; // Max wards a player can have active

  constructor(config: GameContextConfig) {
    this.gameId = config.gameId;
    this.mapConfig = config.mapConfig ?? MOBAConfig;
    this.minionWavesEnabled = config.minionWaves ?? true;
    this.fogOfWar = new FogOfWarServer();
    this.collisionSystem = new CollisionSystem();
    this.terrain = new Terrain(this.mapConfig);

    // Initialize jungle camps
    this.initializeJungleCamps();
  }

  /**
   * Initialize jungle camps from config.
   */
  private initializeJungleCamps(): void {
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
  spawnJungleCamps(): void {
    for (const camp of this.jungleCamps) {
      camp.spawnCreatures(this);
    }
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
    this.wards.delete(entityId);
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

  // =====================
  // Ward Management
  // =====================

  /**
   * Place a ward at a position.
   * Returns true if ward was placed, false if player has too many wards.
   */
  placeWard(playerId: string, wardType: WardType, position: Vector): ServerWard | null {
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
  removeWard(wardId: string): void {
    const ward = this.wards.get(wardId);
    if (ward) {
      this.wards.delete(wardId);
      this.entities.delete(wardId);
    }
  }

  /**
   * Get all wards.
   */
  getWards(): ServerWard[] {
    return Array.from(this.wards.values());
  }

  /**
   * Get wards owned by a player.
   */
  getWardsByOwner(playerId: string): ServerWard[] {
    return Array.from(this.wards.values())
      .filter(w => w.ownerId === playerId && !w.isDead)
      .sort((a, b) => (a as any).placedAt - (b as any).placedAt);
  }

  /**
   * Get wards for a side.
   */
  getWardsBySide(side: Side): ServerWard[] {
    return Array.from(this.wards.values()).filter(w => w.side === side && !w.isDead);
  }

  /**
   * Update game state for one tick.
   */
  update(dt: number): void {
    this.tick++;
    this.gameTime += dt;

    // Champions walking around walls get their next waypoint
    this.pathFollower.update(this, dt);

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

    // Keep units out of walls and water
    this.resolveTerrain();

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
   * Push units out of walls and the water border.
   */
  private resolveTerrain(): void {
    for (const entity of this.entities.values()) {
      if (entity.isDead) continue;
      if (entity.entityType !== EntityType.CHAMPION &&
          entity.entityType !== EntityType.MINION &&
          entity.entityType !== EntityType.JUNGLE_CAMP) continue;
      this.terrain.resolveCircle(entity.position, entity.getRadius());
    }
  }

  /**
   * Send a champion to a point, walking around walls.
   */
  moveChampion(champion: ServerChampion, destination: Vector): void {
    const path = this.terrain.findPath(champion.position, destination) ?? [destination];
    this.pathFollower.follow(champion, path);
  }

  /**
   * Check if it's time to spawn a minion wave.
   */
  private checkMinionWaveSpawn(): void {
    if (!this.minionWavesEnabled) return;
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
    Logger.game.debug(`Minion wave ${this.minionWaveCount + 1} spawning`);

    const lanes: LaneId[] = ['top', 'mid', 'bot'];
    const waveConfig = this.mapConfig.MINION_WAVES.WAVE_COMPOSITION;
    const withSiege = (this.minionWaveCount + 1) % this.mapConfig.MINION_WAVES.SIEGE_EVERY === 0;

    for (const lane of lanes) {
      // Spawn minions for both sides
      this.spawnLaneMinions(0, lane, waveConfig, withSiege); // Blue side
      this.spawnLaneMinions(1, lane, waveConfig, withSiege); // Red side
    }
  }

  /**
   * Spawn one wave for a side in a lane, outside the wave timer.
   */
  spawnLaneWave(side: Side, lane: LaneId, options: { siege?: boolean } = {}): void {
    this.spawnLaneMinions(side, lane, this.mapConfig.MINION_WAVES.WAVE_COMPOSITION, options.siege ?? false);
  }

  /**
   * Spawn minions for a specific side and lane.
   * The wave marches in rows (melee in front, then siege, then casters), up
   * to three side by side, each minion keeping its own offset from the lane center.
   */
  private spawnLaneMinions(
    side: Side,
    lane: LaneId,
    waveConfig: { swordsmen: number; archers: number },
    withSiege: boolean
  ): void {
    const laneConfig = this.mapConfig.LANES[lane.toUpperCase() as 'TOP' | 'MID' | 'BOT'];

    // Get waypoints - blue side uses them as-is, red side reverses them
    const waypoints = side === 0
      ? laneConfig.waypoints.map(w => new Vector(w.x, w.y))
      : [...laneConfig.waypoints].reverse().map(w => new Vector(w.x, w.y));

    // Lane direction out of the base, for placing the formation
    const nexusPoint = waypoints[0].clone();
    const nextWaypoint = waypoints.length > 1 ? waypoints[1] : nexusPoint;
    const laneDirection = Vector.direction(nexusPoint, nextWaypoint);
    const perpDirection = new Vector(-laneDirection.y, laneDirection.x);

    // Offset spawn position AWAY from nexus so minions don't spawn inside its collider
    const NEXUS_SPAWN_OFFSET = 150;
    const ROW_SPACING = 45; // Distance between rows along the lane
    const LANE_SPREAD = 22; // Distance between minions side by side
    const PER_ROW = 3;

    const order: MinionType[] = [
      ...Array<MinionType>(waveConfig.swordsmen).fill('melee'),
      ...(withSiege ? ['siege' as MinionType] : []),
      ...Array<MinionType>(waveConfig.archers).fill('caster'),
    ];
    const rows: MinionType[][] = [];
    for (const type of order) {
      const last = rows[rows.length - 1];
      // Start a new row when full or when the minion type changes
      if (!last || last.length >= PER_ROW || last[0] !== type) rows.push([type]);
      else last.push(type);
    }

    const statScale = this.getMinionStatScale();
    // Skip waypoint[0] (nexus) since we spawn minions offset from there
    const minionWaypoints = waypoints.slice(1);

    rows.forEach((row, rowIndex) => {
      // Front row is furthest along the lane
      const forwardOffset = NEXUS_SPAWN_OFFSET + (rows.length - 1 - rowIndex) * ROW_SPACING;
      row.forEach((minionType, i) => {
        const laneOffset = (i - (row.length - 1) / 2) * LANE_SPREAD;
        const spawnPos = nexusPoint.clone()
          .add(laneDirection.scaled(forwardOffset))
          .add(perpDirection.scaled(laneOffset));

        this.addEntity(new ServerMinion({
          id: this.generateEntityId(),
          position: spawnPos,
          side,
          minionType,
          lane,
          waypoints: minionWaypoints.map(w => w.clone()),
          laneOffset,
          statScale,
        }));
      });
    });
  }

  /**
   * Minions get stronger as the game goes on.
   */
  private getMinionStatScale(): { health: number; damage: number } {
    const { SCALING_PER_MINUTE, MAX_SCALING_MINUTES } = this.mapConfig.MINION_WAVES;
    const minutes = Math.min(Math.floor(this.gameTime / 60), MAX_SCALING_MINUTES);
    return {
      health: 1 + SCALING_PER_MINUTE.health * minutes,
      damage: 1 + SCALING_PER_MINUTE.damage * minutes,
    };
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

    if (type === GameEventType.DAMAGE) {
      this.trackChampionAggression(data.sourceId as string | undefined, data.entityId as string);
    }
  }

  /**
   * Remember champion-on-champion damage so minions can respond to "calls for help".
   */
  private trackChampionAggression(sourceId: string | undefined, targetId: string): void {
    if (!sourceId) return;
    const source = this.champions.get(sourceId);
    const target = this.champions.get(targetId);
    if (source && target && source.side !== target.side) {
      this.championAggression.set(sourceId, { victimId: targetId, time: this.gameTime });
    }
  }

  /**
   * The champion this champion last damaged, if it did within `withinSeconds`.
   */
  getRecentChampionVictim(attackerId: string, withinSeconds: number): ServerChampion | undefined {
    const aggression = this.championAggression.get(attackerId);
    if (!aggression || this.gameTime - aggression.time > withinSeconds) return undefined;
    return this.champions.get(aggression.victimId);
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
    return this.fogOfWar.getVisibleEntities(this, forSide);
  }

  /**
   * Check if an entity is visible to a side.
   */
  isEntityVisibleTo(entity: ServerEntity, side: Side): boolean {
    return this.fogOfWar.isVisibleTo(entity, side);
  }

  /**
   * Alias for isEntityVisibleTo for compatibility.
   */
  isVisibleTo(entity: ServerEntity, side: Side): boolean {
    return this.isEntityVisibleTo(entity, side);
  }

  /**
   * Check if a position is visible to a side.
   */
  isPositionVisibleTo(position: Vector, side: Side): boolean {
    return this.fogOfWar.isPositionVisibleTo(position, side);
  }

  /**
   * Check if source can target the target (visibility check).
   */
  canTarget(source: ServerEntity, target: ServerEntity): boolean {
    return this.fogOfWar.canTarget(source, target);
  }

  /**
   * Get the fog of war system.
   */
  getFogOfWar(): FogOfWarServer {
    return this.fogOfWar;
  }

  /**
   * Get entities within a radius of a position.
   */
  getEntitiesInRadius(position: Vector, radius: number): ServerEntity[] {
    const radiusSq = radius * radius;
    return Array.from(this.entities.values()).filter(entity => {
      // Skip dead entities
      if (entity.isDead) return false;
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
