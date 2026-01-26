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
import { ReliableEventQueue, shouldSendReliably } from '../network/ReliableEventQueue';
import { Logger } from '../utils/Logger';
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
            Logger.game.warn(`Cannot start game ${this.gameId}, state is ${this.state}`);
            return;
        }
        this.state = 'starting';
        Logger.game.info(`Starting game ${this.gameId} with ${this.players.size} players`);
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
        const redNexus = new ServerNexus({
            id: this.context.generateEntityId(),
            position: new Vector(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y),
            side: 1,
        });
        this.context.addEntity(redNexus);
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
        }
        Logger.game.debug(`Spawned ${MOBAConfig.TOWERS.POSITIONS.length} towers and 2 nexuses`);
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
        for (const [playerId, playerInfo] of this.players) {
            const definition = this.championDefinitions.get(playerInfo.championId);
            if (!definition) {
                Logger.game.error(`Unknown champion: ${playerInfo.championId} for player ${playerId}`);
                continue;
            }
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
            Logger.champion.info(`Spawned ${definition.name} for player ${playerId}`);
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
            Logger.input.debug(`Invalid input from ${playerId}: ${result.reason}`);
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
            // Get visible entities for this player (based on fog of war)
            // Send ALL visible entities every tick - simpler and no disappearing entity bugs
            const visibleEntities = this.context.getVisibleEntities(playerInfo.side);
            // Get reliable events to send (new + retries)
            const reliableEventsToSend = this.reliableEventQueue.getEventsToSend(playerId, tick);
            // Combine reliable events with unreliable ones
            const eventsForPlayer = [...reliableEventsToSend, ...unreliableEvents];
            // Use StateSerializer for delta compression
            const update = this.stateSerializer.createStateUpdate(visibleEntities, playerId, tick, this.context.getGameTime(), inputAcks, eventsForPlayer, visibleEntities);
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
        // Clear serializer and reliable event queue state
        this.stateSerializer.clearPlayerState(playerId);
        this.reliableEventQueue.clearPlayer(playerId);
        Logger.game.info(`Player ${playerId} disconnected from game ${this.gameId}`);
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
        Logger.game.info(`Player ${playerId} reconnected to game ${this.gameId}`);
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