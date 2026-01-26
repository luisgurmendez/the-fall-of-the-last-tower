/**
 * GameRoom - Manages a single game match.
 *
 * Coordinates:
 * - Game loop (ServerGame)
 * - Game state (ServerGameContext)
 * - Input processing (InputHandler)
 * - State broadcasting
 */
import { Side, StateUpdate, FullStateSnapshot, ChampionDefinition } from '@siege/shared';
import type { ClientInput } from '@siege/shared';
export interface PlayerInfo {
    playerId: string;
    side: Side;
    championId: string;
    connected: boolean;
}
export interface GameRoomConfig {
    gameId: string;
    players: PlayerInfo[];
    championDefinitions: Map<string, ChampionDefinition>;
    onStateUpdate?: (playerId: string, update: StateUpdate) => void;
    onGameEnd?: (winningSide: Side) => void;
}
export type GameRoomState = 'waiting' | 'starting' | 'playing' | 'ended';
export declare class GameRoom {
    readonly gameId: string;
    private state;
    private game;
    private context;
    private inputHandler;
    private stateSerializer;
    private reliableEventQueue;
    private players;
    private championDefinitions;
    private onStateUpdate?;
    private onGameEnd?;
    private gameStartTime;
    constructor(config: GameRoomConfig);
    /**
     * Start the game.
     */
    start(): void;
    /**
     * Spawn all structures (nexuses and towers).
     */
    private spawnStructures;
    /**
     * Stop the game.
     */
    stop(): void;
    /**
     * Spawn all champions.
     */
    private spawnChampions;
    /**
     * Handle a player input.
     */
    handleInput(playerId: string, input: ClientInput): void;
    /**
     * Called each game tick.
     */
    private onTick;
    /**
     * Broadcast state to all players.
     * Uses delta compression and priority-based filtering to minimize bandwidth.
     * Important events are sent via reliable delivery with retries.
     */
    private broadcastState;
    /**
     * Check win conditions.
     */
    private checkWinConditions;
    /**
     * Handle event acknowledgment from client.
     * Removes acknowledged events from reliable delivery queue.
     */
    handleEventAck(playerId: string, lastEventId: number): void;
    /**
     * Handle player disconnect.
     */
    handleDisconnect(playerId: string): void;
    /**
     * Handle player reconnect.
     */
    handleReconnect(playerId: string): FullStateSnapshot | null;
    /**
     * Get current game state.
     */
    getState(): GameRoomState;
    /**
     * Get game time in seconds.
     */
    getGameTime(): number;
    /**
     * Get all player IDs.
     */
    getPlayerIds(): string[];
    /**
     * Check if all players are connected.
     */
    allPlayersConnected(): boolean;
    /**
     * Get player info with entity IDs.
     * Used for game start message.
     */
    getPlayersWithEntityIds(): Array<{
        playerId: string;
        championId: string;
        side: number;
        entityId: string;
    }>;
    /**
     * Get initial full state snapshot for a player.
     * Used to send entity state immediately on game start.
     */
    getInitialState(playerId: string): FullStateSnapshot;
}
//# sourceMappingURL=GameRoom.d.ts.map