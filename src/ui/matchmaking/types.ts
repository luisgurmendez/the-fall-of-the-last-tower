/**
 * Types shared by MatchmakingUI and its screens. MatchmakingUI re-exports
 * them, so other code keeps importing them from MatchmakingUI.
 */

/**
 * Screen identifiers.
 */
export type ScreenId =
  | "menu"
  | "champion-select"
  | "connecting"
  | "queue"
  | "match-found"
  | "how-to-play"
  | "error";

/**
 * Connection status.
 */
export type ConnectionStatus = "offline" | "connecting" | "online";

/**
 * Match data received from server.
 */
export interface MatchData {
  gameId: string;
  yourSide: number;
  players: Array<{
    playerId: string;
    championId: string;
    side: number;
    entityId: string;
  }>;
}

/**
 * Callbacks for game events.
 */
export interface MatchmakingUICallbacks {
  onGameStart?: (matchData: MatchData) => void;
  onGameReady?: () => void;
}
