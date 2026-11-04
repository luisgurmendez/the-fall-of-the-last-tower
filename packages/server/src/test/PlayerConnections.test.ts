/**
 * Which connection plays each player: a newer connection of the same player
 * (a reconnect, or a second tab with the same session) takes the player over,
 * and the one it replaced is cleared so nothing reaches it or comes from it.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PlayerConnections } from '../network/playerConnections';
import type { WebSocketConnection } from '../network/WebSocketServer';

function connection(id: string): WebSocketConnection {
  return {
    id,
    playerId: null,
    gameId: null,
    send: () => {},
    close: () => {},
    isOpen: () => true,
  };
}

describe('PlayerConnections', () => {
  let players: PlayerConnections;

  beforeEach(() => {
    players = new PlayerConnections();
  });

  it('a connection claims its player both ways', () => {
    const conn = connection('conn-1');
    expect(players.claim('p1', conn)).toBeNull();
    expect(players.playerOf('conn-1')).toBe('p1');
    expect(players.connectionOf('p1')).toBe(conn);
    expect(conn.playerId).toBe('p1');
  });

  it('a newer connection takes the player over and gets back the one it replaced', () => {
    const old = connection('conn-2');
    const newer = connection('conn-3');
    players.claim('p1', old);

    expect(players.claim('p1', newer)).toBe(old);
    expect(players.connectionOf('p1')).toBe(newer);
    expect(players.playerOf('conn-3')).toBe('p1');
  });

  it('the replaced connection is no longer the player\'s: no inputs from it, no state to it', () => {
    const old = connection('conn-2');
    old.gameId = 'game-1';
    players.claim('p1', old);
    players.claim('p1', connection('conn-3'));

    expect(players.playerOf('conn-2')).toBeUndefined();
    // The WebSocket server finds a player's connection by its playerId
    expect(old.playerId).toBeNull();
    expect(old.gameId).toBeNull();
  });

  it('the same connection claiming again replaces nothing', () => {
    const conn = connection('conn-1');
    players.claim('p1', conn);
    expect(players.claim('p1', conn)).toBeNull();
    expect(players.connectionOf('p1')).toBe(conn);
    expect(conn.playerId).toBe('p1');
  });

  it('a replaced connection closing later releases nothing', () => {
    const newer = connection('conn-3');
    players.claim('p1', connection('conn-2'));
    players.claim('p1', newer);

    expect(players.release('conn-2')).toBeUndefined();
    expect(players.connectionOf('p1')).toBe(newer);
    expect(players.playerOf('conn-3')).toBe('p1');
  });

  it('the player\'s connection closing releases the player', () => {
    players.claim('p1', connection('conn-1'));
    expect(players.release('conn-1')).toBe('p1');
    expect(players.connectionOf('p1')).toBeUndefined();
    expect(players.playerOf('conn-1')).toBeUndefined();
  });

  it('releasing an unknown connection does nothing', () => {
    players.claim('p1', connection('conn-1'));
    expect(players.release('conn-9')).toBeUndefined();
    expect(players.playerOf('conn-1')).toBe('p1');
  });

  it('a connection claiming another player lets go of the first one', () => {
    const conn = connection('conn-1');
    players.claim('p1', conn);
    expect(players.claim('p2', conn)).toBeNull();

    expect(players.connectionOf('p1')).toBeUndefined();
    expect(players.connectionOf('p2')).toBe(conn);
    expect(players.playerOf('conn-1')).toBe('p2');
  });

  it('taking one player over leaves the others alone', () => {
    const other = connection('conn-1');
    players.claim('p2', other);
    players.claim('p1', connection('conn-2'));
    players.claim('p1', connection('conn-3'));

    expect(players.connectionOf('p2')).toBe(other);
    expect(players.playerOf('conn-1')).toBe('p2');
    expect(other.playerId).toBe('p2');
  });

  it('a player can be taken over again and again: only the newest plays', () => {
    const conns = [1, 2, 3, 4].map(n => connection(`conn-${n}`));
    let replaced: WebSocketConnection | null = null;
    for (const conn of conns) replaced = players.claim('p1', conn);

    expect(replaced).toBe(conns[2]);
    expect(players.connectionOf('p1')).toBe(conns[3]);
    expect(conns.slice(0, 3).every(conn => conn.playerId === null)).toBe(true);
    expect(conns.slice(0, 3).every(conn => players.playerOf(conn.id) === undefined)).toBe(true);
  });
});
