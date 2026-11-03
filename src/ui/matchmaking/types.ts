/**
 * Types shared by MatchmakingUI and its screens. MatchmakingUI re-exports
 * them, so other code keeps importing them from MatchmakingUI.
 */

/**
 * Screen identifiers.
 */
export type ScreenId =
  | "menu"
  | "modes"
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
  /** This player's ID (with several players on a side, which champion is ours) */
  yourPlayerId?: string;
  /** The map it's played on (shared maps.ts) */
  mapId?: string;
  players: Array<{
    playerId: string;
    championId: string;
    side: number;
    entityId: string;
    /** Their summoner spells (D, F) */
    summonerSpells?: string[];
  }>;
}

/**
 * Callbacks for game events.
 */
export interface MatchmakingUICallbacks {
  onGameStart?: (matchData: MatchData) => void;
  onGameReady?: () => void;
}

/**
 * The local player in a match: the one with our player ID (a side may have
 * several players), or else the first on our side (an older server).
 */
export function findLocalPlayer(matchData: MatchData): MatchData["players"][number] | undefined {
  return matchData.players.find((p) => p.playerId === matchData.yourPlayerId)
    ?? matchData.players.find((p) => p.side === matchData.yourSide);
}
