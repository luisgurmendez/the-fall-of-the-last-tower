/**
 * GameRoom - Manages a single game match.
 *
 * Coordinates:
 * - Game loop (ServerGame)
 * - Game state (ServerGameContext)
 * - Input processing (InputHandler)
 * - State broadcasting
 */
import { MOBAConfig, } from '@siege/shared';
import { ServerGame } from './ServerGame';
import { ServerGameContext } from './ServerGameContext';
import { ServerChampion } from '../simulation/ServerChampion';
import { InputHandler } from '../network/InputHandler';
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
        // Spawn champions
        this.spawnChampions();
        // Start the game loop
        this.state = 'playing';
        this.gameStartTime = Date.now();
        this.game.start();
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
                console.error(`[GameRoom ${this.gameId}] Unknown champion: ${playerInfo.championId}`);
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
     */
    broadcastState(tick) {
        if (!this.onStateUpdate)
            return;
        const events = this.context.flushEvents();
        const inputAcks = this.inputHandler.getAllAckedSeqs();
        for (const [playerId] of this.players) {
            const snapshots = this.context.createSnapshot(playerId);
            const update = {
                tick,
                timestamp: Date.now(),
                gameTime: this.context.getGameTime(),
                inputAcks,
                deltas: snapshots.map(s => ({
                    entityId: s.entityId,
                    changeMask: 0xFFFF,
                    data: s,
                })),
                events,
            };
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
     * Handle player disconnect.
     */
    handleDisconnect(playerId) {
        const playerInfo = this.players.get(playerId);
        if (playerInfo) {
            playerInfo.connected = false;
        }
        this.inputHandler.clearPlayer(playerId);
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
}
//# sourceMappingURL=GameRoom.js.map