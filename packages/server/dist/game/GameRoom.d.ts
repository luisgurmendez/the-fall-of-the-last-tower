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
     */
    private broadcastState;
    /**
     * Check win conditions.
     */
    private checkWinConditions;
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
}
//# sourceMappingURL=GameRoom.d.ts.map