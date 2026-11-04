/**
 * Which connection plays each player. A player's newer connection (a
 * reconnect, or a second tab with the same session) takes the player over:
 * the connection it replaced stops being the player's, so its inputs are
 * dropped and no state goes to it; the server then closes it
 * (CONNECTION_REPLACED_CODE), so the old tab knows instead of freezing.
 */

import type { WebSocketConnection } from './WebSocketServer';

export class PlayerConnections {
  private readonly playerByConnection = new Map<string, string>();
  private readonly connectionByPlayer = new Map<string, WebSocketConnection>();

  /**
   * The connection plays the player from now on. Returns the connection that
   * played them before, if another one did (for the caller to close).
   */
  claim(playerId: string, connection: WebSocketConnection): WebSocketConnection | null {
    // The connection played someone else before (a READY for a new player ID)
    const before = this.playerByConnection.get(connection.id);
    if (before !== undefined && before !== playerId) this.connectionByPlayer.delete(before);

    const previous = this.connectionByPlayer.get(playerId);
    const replaced = previous && previous.id !== connection.id ? previous : null;
    if (replaced) {
      this.playerByConnection.delete(replaced.id);
      // The WebSocket server finds a player's connection by its playerId
      replaced.playerId = null;
      replaced.gameId = null;
    }

    this.playerByConnection.set(connection.id, playerId);
    this.connectionByPlayer.set(playerId, connection);
    connection.playerId = playerId;
    return replaced;
  }

  /** The player a connection plays, if any */
  playerOf(connectionId: string): string | undefined {
    return this.playerByConnection.get(connectionId);
  }

  /** The connection that plays a player, if any */
  connectionOf(playerId: string): WebSocketConnection | undefined {
    return this.connectionByPlayer.get(playerId);
  }

  /**
   * A connection closed: the player it played, if it still played one (a
   * replaced connection plays nobody, so its close doesn't disconnect them).
   */
  release(connectionId: string): string | undefined {
    const playerId = this.playerByConnection.get(connectionId);
    if (playerId === undefined) return undefined;
    this.playerByConnection.delete(connectionId);
    this.connectionByPlayer.delete(playerId);
    return playerId;
  }
}
