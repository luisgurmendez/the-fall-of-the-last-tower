/**
 * GameRoom - Manages a single game match.
 *
 * Coordinates:
 * - Game loop (ServerGame)
 * - Game state (ServerGameContext)
 * - Input processing (InputHandler)
 * - State broadcasting
 */
import { Vector, MOBAConfig, } from '@siege/shared';
import { ServerGame } from './ServerGame';
import { ServerGameContext } from './ServerGameContext';
import { ServerChampion } from '../simulation/ServerChampion';
import { ServerTower } from '../simulation/ServerTower';
import { ServerNexus } from '../simulation/ServerNexus';
import { InputHandler } from '../network/InputHandler';
import { StateSerializer } from '../network/StateSerializer';
import { EntityPrioritizer } from '../network/EntityPrioritizer';
import { ReliableEventQueue, shouldSendReliably } from '../network/ReliableEventQueue';
export class GameRoom {
    constructor(config) {
        this.state = 'waiting';
        this.players = new Map();
        // Game timing
        this.gameStartTime = 0;
        this.gameId = config.gameId;
        this.championDefinitions = config.championDefinitions;
        this.onStateUpdate = config.onStateUpdate;
        this.onGameEnd = config.onGameEnd;
        // Initialize players
        for (const player of config.players) {
            this.players.set(player.playerId, player);
        }
        // Create game context
        this.context = new ServerGameContext({
            gameId: config.gameId,
        });
        // Create input handler
        this.inputHandler = new InputHandler();
        // Create state serializer for delta compression
        this.stateSerializer = new StateSerializer();
        // Create entity prioritizer for bandwidth optimization
        this.entityPrioritizer = new EntityPrioritizer();
        // Create reliable event queue for important events
        this.reliableEventQueue = new ReliableEventQueue();
        // Create game loop
        this.game = new ServerGame({
            onTick: this.onTick.bind(this),
            onStateUpdate: this.broadcastState.bind(this),
        });
    }
    /**
     * Start the game.
     */
    start() {
        if (this.state !== 'waiting') {
            console.warn(`[GameRoom ${this.gameId}] Cannot start, state is ${this.state}`);
            return;
        }
        this.state = 'starting';
        console.log(`[GameRoom ${this.gameId}] Starting game with ${this.players.size} players`);
        // Spawn structures first (nexuses and towers)
        this.spawnStructures();
        // Spawn jungle camps
        this.context.spawnJungleCamps();
        // Spawn champions
        this.spawnChampions();
        // Start the game loop
        this.state = 'playing';
        this.gameStartTime = Date.now();
        this.game.start();
    }
    /**
     * Spawn all structures (nexuses and towers).
     */
    spawnStructures() {
        // Spawn nexuses
        const blueNexus = new ServerNexus({
            id: this.context.generateEntityId(),
            position: new Vector(MOBAConfig.NEXUS.BLUE.x, MOBAConfig.NEXUS.BLUE.y),
            side: 0,
        });
        this.context.addEntity(blueNexus);
        console.log(`[GameRoom ${this.gameId}] Spawned Blue nexus at (${MOBAConfig.NEXUS.BLUE.x}, ${MOBAConfig.NEXUS.BLUE.y})`);
        const redNexus = new ServerNexus({
            id: this.context.generateEntityId(),
            position: new Vector(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y),
            side: 1,
        });
        this.context.addEntity(redNexus);
        console.log(`[GameRoom ${this.gameId}] Spawned Red nexus at (${MOBAConfig.NEXUS.RED.x}, ${MOBAConfig.NEXUS.RED.y})`);
        // Spawn towers from MOBAConfig
        // Group towers by side and lane to determine tier (1=outer, 2=inner)
        const towersBySideLane = new Map();
        for (let i = 0; i < MOBAConfig.TOWERS.POSITIONS.length; i++) {
            const towerConfig = MOBAConfig.TOWERS.POSITIONS[i];
            const key = `${towerConfig.side}_${towerConfig.lane}`;
            const count = towersBySideLane.get(key) || 0;
            towersBySideLane.set(key, count + 1);
            // Tier is based on order: first tower = outer (1), second = inner (2)
            const tier = (count + 1);
            const tower = new ServerTower({
                id: this.context.generateEntityId(),
                position: new Vector(towerConfig.position.x, towerConfig.position.y),
                side: towerConfig.side,
                lane: towerConfig.lane,
                tier,
            });
            this.context.addEntity(tower);
            console.log(`[GameRoom ${this.gameId}] Spawned tower: side=${towerConfig.side}, lane=${towerConfig.lane}, tier=${tier}, pos=(${towerConfig.position.x}, ${towerConfig.position.y})`);
        }
        console.log(`[GameRoom ${this.gameId}] Spawned ${MOBAConfig.TOWERS.POSITIONS.length} towers total`);
    }
    /**
     * Stop the game.
     */
    stop() {
        this.game.stop();
        this.state = 'ended';
    }
    /**
     * Spawn all champions.
     */
    spawnChampions() {
        // DEBUG: Log available definitions
        console.log(`[GameRoom ${this.gameId}] Available champion definitions:`, Array.from(this.championDefinitions.keys()));
        for (const [playerId, playerInfo] of this.players) {
            console.log(`[GameRoom ${this.gameId}] Player ${playerId} selected championId: "${playerInfo.championId}"`);
            const definition = this.championDefinitions.get(playerInfo.championId);
            if (!definition) {
                console.error(`[GameRoom ${this.gameId}] Unknown champion: ${playerInfo.championId}`);
                continue;
            }
            console.log(`[GameRoom ${this.gameId}] Found definition: id=${definition.id}, name=${definition.name}, Q=${definition.abilities.Q}`);
            const spawnPos = playerInfo.side === 0
                ? MOBAConfig.CHAMPION_SPAWN.BLUE
                : MOBAConfig.CHAMPION_SPAWN.RED;
            const champion = new ServerChampion({
                id: this.context.generateEntityId(),
                position: spawnPos.clone(),
                side: playerInfo.side,
                definition,
                playerId,
            });
            this.context.addChampion(champion, playerId);
            console.log(`[GameRoom ${this.gameId}] Spawned ${definition.name} for player ${playerId}`);
        }
    }
    /**
     * Handle a player input.
     */
    handleInput(playerId, input) {
        if (this.state !== 'playing')
            return;
        const result = this.inputHandler.queueInput(playerId, input);
        if (!result.valid) {
            console.warn(`[GameRoom ${this.gameId}] Invalid input from ${playerId}: ${result.reason}`);
        }
    }
    /**
     * Called each game tick.
     */
    onTick(tick, dt) {
        // 1. Process inputs
        this.inputHandler.processInputs(this.context);
        // 2. Update game state
        this.context.update(dt);
        // 3. Check win conditions
        this.checkWinConditions();
    }
    /**
     * Broadcast state to all players.
     * Uses delta compression and priority-based filtering to minimize bandwidth.
     * Important events are sent via reliable delivery with retries.
     */
    broadcastState(tick) {
        if (!this.onStateUpdate)
            return;
        // DEBUG: Log entity counts
        const allEntities = this.context.getAllEntities();
        if (tick % 30 === 0) { // Log every second
            console.log(`[GameRoom ${this.gameId}] Tick ${tick}: ${allEntities.length} total entities, ${this.context.getAllChampions().length} champions`);
        }
        const allEvents = this.context.flushEvents();
        const inputAcks = this.inputHandler.getAllAckedSeqs();
        const playerIds = Array.from(this.players.keys());
        // Separate reliable and unreliable events
        const reliableEvents = [];
        const unreliableEvents = [];
        for (const event of allEvents) {
            if (shouldSendReliably(event)) {
                reliableEvents.push(event);
                // Queue reliable events for all players
                this.reliableEventQueue.queueEventForAll(playerIds, event, tick);
            }
            else {
                unreliableEvents.push(event);
            }
        }
        for (const [playerId, playerInfo] of this.players) {
            // Get player's champion for distance-based prioritization
            const playerChampion = this.context.getChampionByPlayerId(playerId);
            // Get visible entities for this player (based on fog of war)
            const visibleEntities = this.context.getVisibleEntities(playerInfo.side);
            // DEBUG: Log visible entities count
            if (tick % 30 === 0) {
                console.log(`[GameRoom ${this.gameId}] Player ${playerId} (side ${playerInfo.side}): ${visibleEntities.length} visible entities, champion exists: ${!!playerChampion}`);
            }
            // Apply priority-based filtering (nearby entities update more frequently)
            const prioritizedEntities = this.entityPrioritizer.prioritizeEntities(visibleEntities, playerChampion ?? null, playerId, tick);
            // DEBUG: Log prioritized entities count
            if (tick % 30 === 0) {
                console.log(`[GameRoom ${this.gameId}] After prioritization for ${playerId}: ${prioritizedEntities.length} entities`);
            }
            // Get reliable events to send (new + retries)
            const reliableEventsToSend = this.reliableEventQueue.getEventsToSend(playerId, tick);
            // Combine reliable events with unreliable ones
            const eventsForPlayer = [...reliableEventsToSend, ...unreliableEvents];
            // Use StateSerializer for delta compression
            // Pass both prioritized entities (for updates) and full visible list (for removal detection)
            const update = this.stateSerializer.createStateUpdate(prioritizedEntities, playerId, tick, this.context.getGameTime(), inputAcks, eventsForPlayer, visibleEntities // Full visible list for detecting removed entities
            );
            // Include the last event ID for acknowledgment
            if (reliableEventsToSend.length > 0) {
                const lastReliableEvent = reliableEventsToSend[reliableEventsToSend.length - 1];
                update.lastEventId = lastReliableEvent.eventId;
            }
            this.onStateUpdate(playerId, update);
        }
    }
    /**
     * Check win conditions.
     */
    checkWinConditions() {
        // TODO: Check if nexus is destroyed
        // For now, no automatic win
    }
    /**
     * Handle event acknowledgment from client.
     * Removes acknowledged events from reliable delivery queue.
     */
    handleEventAck(playerId, lastEventId) {
        this.reliableEventQueue.acknowledgeEvents(playerId, lastEventId);
    }
    /**
     * Handle player disconnect.
     */
    handleDisconnect(playerId) {
        const playerInfo = this.players.get(playerId);
        if (playerInfo) {
            playerInfo.connected = false;
        }
        this.inputHandler.clearPlayer(playerId);
        // Clear serializer, prioritizer, and reliable event queue state
        this.stateSerializer.clearPlayerState(playerId);
        this.entityPrioritizer.clearPlayer(playerId);
        this.reliableEventQueue.clearPlayer(playerId);
        console.log(`[GameRoom ${this.gameId}] Player ${playerId} disconnected`);
    }
    /**
     * Handle player reconnect.
     */
    handleReconnect(playerId) {
        const playerInfo = this.players.get(playerId);
        if (!playerInfo) {
            return null;
        }
        playerInfo.connected = true;
        console.log(`[GameRoom ${this.gameId}] Player ${playerId} reconnected`);
        // Send full state snapshot
        return {
            tick: this.game.getCurrentTick(),
            timestamp: Date.now(),
            gameTime: this.context.getGameTime(),
            entities: this.context.createSnapshot(playerId),
            events: [], // Don't send old events on reconnect
        };
    }
    /**
     * Get current game state.
     */
    getState() {
        return this.state;
    }
    /**
     * Get game time in seconds.
     */
    getGameTime() {
        return this.context.getGameTime();
    }
    /**
     * Get all player IDs.
     */
    getPlayerIds() {
        return Array.from(this.players.keys());
    }
    /**
     * Check if all players are connected.
     */
    allPlayersConnected() {
        for (const player of this.players.values()) {
            if (!player.connected)
                return false;
        }
        return true;
    }
    /**
     * Get player info with entity IDs.
     * Used for game start message.
     */
    getPlayersWithEntityIds() {
        const result = [];
        for (const [playerId, playerInfo] of this.players) {
            const champion = this.context.getChampionByPlayerId(playerId);
            result.push({
                playerId,
                championId: playerInfo.championId,
                side: playerInfo.side,
                entityId: champion?.id || '',
            });
        }
        return result;
    }
    /**
     * Get initial full state snapshot for a player.
     * Used to send entity state immediately on game start.
     */
    getInitialState(playerId) {
        return {
            tick: this.game.getCurrentTick(),
            timestamp: Date.now(),
            gameTime: this.context.getGameTime(),
            entities: this.context.createSnapshot(playerId),
            events: [],
        };
    }
}
//# sourceMappingURL=GameRoom.js.map