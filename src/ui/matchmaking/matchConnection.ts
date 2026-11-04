/**
 * Network client wiring for matchmaking: creates the NetworkClient when the
 * player locks in or starts a practice match, keeps the player ID and the
 * session token in sessionStorage, and buffers the full state and the state
 * updates that arrive during the loading screen, before OnlineGame exists.
 * What the screens do on each event is up to MatchConnectionEvents.
 */

import { NetworkClient } from "../../../packages/client/src/network/NetworkClient";
import type { LobbyRequest, LobbyState, MapId } from "@siege/shared";
import type { ConnectionStatus } from "./types";
import { rememberLastMatch, type LastMatch } from "./currentMatch";

/**
 * What MatchmakingUI does when the connection reports something.
 */
export interface MatchConnectionEvents {
  /** Champion to send with the ready message, read once the socket is open */
  getChampionId(): string;
  /** Summoner spells (D, F) to send with it */
  getSummonerSpells(): string[];
  /** Update the connection status display */
  onStatusChange(status: ConnectionStatus): void;
  /** The ready message was sent in queue mode */
  onQueueEntered(): void;
  /** The connection closed, after onStatusChange("offline") */
  onDisconnect(): void;
  onLatencyUpdate(latency: number): void;
  onError(error: string): void;
  /** The server started the match */
  onGameStart(data: any): void;
  /** The server added the player to the queue */
  onQueueJoined(position: number, queueSize: number): void;
  /** The player's room changed (lobby mode) */
  onLobbyState?(state: LobbyState): void;
}

/**
 * The matchmaking network client and the state buffered for OnlineGame.
 */
export class MatchConnection {
  // Network
  private networkClient: NetworkClient | null = null;
  private serverUrl: string;
  private playerId: string;

  // State
  private bufferedFullState: any = null;
  private bufferedStateUpdates: any[] = [];
  /** About 30 seconds of updates at 30 Hz */
  private static readonly MAX_BUFFERED_UPDATES = 900;

  /**
   * @param getAccountToken The token of the account the player is signed in
   *   with, sent with READY (none: a guest)
   */
  constructor(serverUrl: string, private readonly getAccountToken: () => string | undefined = () => undefined) {
    this.serverUrl = serverUrl;
    this.playerId = this.generatePlayerId();
  }

  /**
   * Play as the player of a live match from now on (CONTINUE): its id and
   * session token become the tab's, so READY takes it back.
   */
  adopt(match: LastMatch): void {
    this.playerId = match.playerId;
    sessionStorage.setItem("siege-player-id", match.playerId);
    sessionStorage.setItem("siege-session-token", match.sessionToken);
  }

  /**
   * Generate a unique player ID.
   * Uses sessionStorage so each tab/window gets a unique ID.
   */
  private generatePlayerId(): string {
    const stored = sessionStorage.getItem("siege-player-id");
    if (stored) return stored;

    const id = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("siege-player-id", id);
    return id;
  }

  /**
   * Create the network client, set up its handlers and connect.
   */
  connect(
    mode: "queue" | "practice" | "lobby" | "resume",
    botChampionId: string | undefined,
    events: MatchConnectionEvents,
    practice?: { size: number; map: MapId },
    lobby?: { create?: boolean; code?: string; name: string },
  ): void {
    // One client at a time: a previous one left open would say READY for the
    // same player again (a reconnect), and take the player from this one
    this.disconnect();

    // Create network client
    this.networkClient = new NetworkClient({
      serverUrl: this.serverUrl,
      playerId: this.playerId,
      gameId: "", // Will be assigned by server
      sessionToken: sessionStorage.getItem("siege-session-token") ?? undefined,
    });

    // Setup event handlers
    this.networkClient.onConnect = () => {
      console.log("[MatchmakingUI] Connected to server");
      events.onStatusChange("online");

      // Send ready message to join queue with selected champion
      console.log(
        `[MatchmakingUI] Sending ready with selectedChampionId="${events.getChampionId()}"`,
      );
      this.networkClient?.sendReady(events.getChampionId(), {
        mode,
        botChampionId,
        summonerSpells: events.getSummonerSpells(),
        practiceSize: practice?.size,
        mapId: practice?.map,
        lobby: lobby ? { create: lobby.create, code: lobby.code } : undefined,
        name: lobby?.name,
        accountToken: this.getAccountToken(),
      });
      if (mode === "queue") {
        events.onQueueEntered();
      }
    };

    this.networkClient.onDisconnect = (code, reason) => {
      console.log(`[MatchmakingUI] Disconnected: ${code} - ${reason}`);
      events.onStatusChange("offline");
      events.onDisconnect();
    };

    this.networkClient.onLatencyUpdate = (latency) => {
      events.onLatencyUpdate(latency);
    };

    this.networkClient.onError = (error) => {
      console.error("[MatchmakingUI] Error:", error);
      events.onError(error);
    };

    this.networkClient.onLobbyState = (state) => {
      events.onLobbyState?.(state);
    };

    this.networkClient.onGameStart = (data: any) => {
      console.log("[MatchmakingUI] Game starting:", data);
      // Kept for the whole browser: a new tab can go back to it if this one closes
      const sessionToken = sessionStorage.getItem("siege-session-token");
      if (sessionToken) rememberLastMatch(browserLocalStorage(), { playerId: this.playerId, sessionToken });
      events.onGameStart(data);
    };

    this.networkClient.onFullState = (snapshot: any) => {
      // Buffer the full state so OnlineGame can process it after initialization
      // This is needed because FULL_STATE is sent immediately after GAME_START,
      // but OnlineGame isn't created until after the loading animation
      console.log(
        "[MatchmakingUI] Buffering full state:",
        snapshot?.entities?.length || 0,
        "entities",
      );
      this.bufferedFullState = snapshot;
      // Updates from before this full state are already included in it
      this.bufferedStateUpdates = [];
    };

    this.networkClient.onStateUpdate = (update: any) => {
      // Keep the deltas that arrive during the loading screen: the server
      // won't resend what they changed, so OnlineGame replays them after
      // the full state (see takeBufferedStateUpdates)
      if (this.bufferedStateUpdates.length < MatchConnection.MAX_BUFFERED_UPDATES) {
        this.bufferedStateUpdates.push(update);
      }
    };

    // Handle custom events (session, queue joined, etc.)
    this.networkClient.onEvent = (event) => {
      if (event.event === "session") {
        // Persist so the player can rejoin their game after a page reload
        sessionStorage.setItem("siege-session-token", event.sessionToken);
      } else if (event.event === "queue_joined") {
        events.onQueueJoined(event.position, event.queueSize);
      }
    };

    // Connect to server. A failed connection also closes the socket, which
    // is reported through onDisconnect, so the rejection needs no handling.
    this.networkClient.connect().catch(() => {});
  }

  /** The player's ID (kept for the tab's session) */
  getPlayerId(): string {
    return this.playerId;
  }

  /**
   * Ask something about the player's room (lobby mode).
   */
  sendLobby(request: LobbyRequest): void {
    this.networkClient?.sendLobby(request);
  }

  /**
   * Disconnect and drop the network client.
   */
  disconnect(): void {
    this.networkClient?.disconnect();
    this.networkClient = null;
  }

  /**
   * Get the network client (for game to use).
   */
  getNetworkClient(): NetworkClient | null {
    return this.networkClient;
  }

  /**
   * Get the buffered full state (sent by server immediately after GAME_START).
   * Returns null if no state has been received.
   */
  getBufferedFullState(): any {
    return this.bufferedFullState;
  }

  /**
   * Clear the buffered full state after it has been processed.
   */
  clearBufferedFullState(): void {
    this.bufferedFullState = null;
  }

  /**
   * State updates received after the buffered full state, in order. Clears the buffer.
   */
  takeBufferedStateUpdates(): any[] {
    const updates = this.bufferedStateUpdates;
    this.bufferedStateUpdates = [];
    return updates;
  }

  /**
   * Drop the buffered full state and state updates.
   */
  clearBufferedState(): void {
    this.bufferedFullState = null;
    this.bufferedStateUpdates = [];
  }
}

/** The browser's localStorage, if it's allowed */
export function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
