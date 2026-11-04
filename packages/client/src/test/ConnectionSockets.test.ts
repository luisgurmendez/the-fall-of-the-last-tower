/**
 * One socket per player: the network client never has two sockets open at
 * once (connecting twice, reconnect attempts piling up, an old socket's late
 * close), a socket the server replaced with a newer one doesn't reconnect,
 * and matchmaking closes its previous client before making a new one.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { NetworkClient, ConnectionState } from '../network/NetworkClient';
import { MatchConnection, type MatchConnectionEvents } from '../../../../src/ui/matchmaking/matchConnection';
import { CONNECTION_REPLACED_CODE } from '@siege/shared';

/** A WebSocket the test opens, fails and closes by hand; closing is async, as in a browser */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeSocket[] = [];
  /** What each new socket does by itself (nothing: the test opens it) */
  static onCreate: (socket: FakeSocket) => void = () => {};

  readyState = FakeSocket.CONNECTING;
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: any[] = [];

  constructor(public url: string) {
    FakeSocket.all.push(this);
    FakeSocket.onCreate(this);
  }

  send(data: string): void {
    if (this.readyState !== FakeSocket.OPEN) throw new Error('not open');
    this.sent.push(JSON.parse(data));
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState >= FakeSocket.CLOSING) return;
    this.readyState = FakeSocket.CLOSING;
    setTimeout(() => this.closed(code, reason), 0);
  }

  /** The server accepted it */
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  /** It never reached the server */
  fail(): void {
    this.readyState = FakeSocket.CLOSED;
    this.onerror?.(new Error('connection failed'));
    this.onclose?.({ code: 1006, reason: '' });
  }

  /** The server or the network closed it */
  closed(code: number, reason = ''): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  static open(): FakeSocket[] {
    return FakeSocket.all.filter(socket => socket.readyState === FakeSocket.OPEN);
  }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const realWebSocket = (globalThis as any).WebSocket;

/** Reconnect attempts 10 ms apart, so the tests don't wait long */
function makeClient(): NetworkClient {
  return new NetworkClient({
    serverUrl: 'ws://test/ws',
    playerId: 'p1',
    gameId: '',
    reconnectDelay: 10,
    reconnectAttempts: 5,
    heartbeatInterval: 60_000,
  });
}

/** Connect and let the server accept it */
async function connected(client: NetworkClient): Promise<FakeSocket> {
  const done = client.connect();
  const socket = FakeSocket.all.at(-1)!;
  socket.open();
  await done;
  return socket;
}

beforeEach(() => {
  FakeSocket.all = [];
  FakeSocket.onCreate = () => {};
  (globalThis as any).WebSocket = FakeSocket;
});

afterEach(() => {
  (globalThis as any).WebSocket = realWebSocket;
});

describe('NetworkClient sockets', () => {
  let client: NetworkClient;

  beforeEach(() => {
    client = makeClient();
  });

  afterEach(() => {
    client.disconnect();
  });

  it('connecting again while the socket is still opening opens no second one', async () => {
    const first = client.connect();
    const second = client.connect();
    expect(FakeSocket.all.length).toBe(1);

    FakeSocket.all[0].open();
    await first;
    await second;
    expect(client.getState()).toBe(ConnectionState.CONNECTED);
    expect(FakeSocket.all.length).toBe(1);
  });

  it('connecting again while connected opens no second one', async () => {
    await connected(client);
    await client.connect();
    expect(FakeSocket.all.length).toBe(1);
  });

  it('connecting after a failed connection opens a new socket', async () => {
    const first = client.connect();
    FakeSocket.all[0].fail();
    await first.catch(() => {});
    client.disconnect();

    const again = client.connect();
    expect(FakeSocket.all.length).toBe(2);
    FakeSocket.all[1].open();
    await again;
    expect(client.getState()).toBe(ConnectionState.CONNECTED);
  });

  it('a dropped connection still reconnects', async () => {
    const socket = await connected(client);
    socket.closed(1006);
    expect(client.getState()).toBe(ConnectionState.RECONNECTING);

    await wait(30);
    expect(FakeSocket.all.length).toBe(2);
  });

  it('failed reconnect attempts follow one another, they don\'t pile up', async () => {
    // Every new socket fails right away
    FakeSocket.onCreate = socket => setTimeout(() => socket.fail(), 0);
    const socket = await connected(client);
    socket.closed(1006);

    await wait(250);
    // The first socket and one per attempt, never two at once
    expect(FakeSocket.all.length).toBe(1 + 5);
    expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('a reconnect that gets through leaves one socket open, and no more attempts', async () => {
    const socket = await connected(client);
    // The first attempt fails, the second gets through
    let attempts = 0;
    FakeSocket.onCreate = attempt => {
      const fails = ++attempts === 1;
      setTimeout(() => (fails ? attempt.fail() : attempt.open()), 0);
    };
    socket.closed(1006);

    await wait(150);
    expect(FakeSocket.open().length).toBe(1);
    expect(FakeSocket.all.length).toBe(3);
    expect(client.getState()).toBe(ConnectionState.CONNECTED);
  });

  it('an old socket closing late doesn\'t cut off the new one', async () => {
    const onDisconnect = mock();
    client.onDisconnect = onDisconnect;
    await connected(client);

    // disconnect() closes the old socket; its close event comes later
    client.disconnect();
    const fresh = await connected(client);
    await wait(10);

    expect(client.getState()).toBe(ConnectionState.CONNECTED);
    expect(onDisconnect).not.toHaveBeenCalled();
    client.sendMoveInput(1, 2);
    expect(fresh.sent.length).toBe(1);
  });

  it('a socket let go of while opening never reports connected', async () => {
    const onConnect = mock();
    client.onConnect = onConnect;
    client.connect().catch(() => {});
    const socket = FakeSocket.all[0];
    client.disconnect();

    socket.open();
    expect(onConnect).not.toHaveBeenCalled();
    expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('messages from an old socket are ignored', async () => {
    const onStateUpdate = mock();
    client.onStateUpdate = onStateUpdate;
    const old = await connected(client);
    client.disconnect();
    await connected(client);

    old.onmessage?.({ data: JSON.stringify({ type: 1, data: { tick: 1, gameTime: 0, deltas: [], inputAcks: {} } }) });
    expect(onStateUpdate).not.toHaveBeenCalled();
  });

  it('replaced by a newer connection of the player: it says so and doesn\'t reconnect', async () => {
    const onDisconnect = mock();
    client.onDisconnect = onDisconnect;
    const socket = await connected(client);

    socket.closed(CONNECTION_REPLACED_CODE, 'Replaced by a newer connection');
    await wait(40);

    expect(onDisconnect).toHaveBeenCalledWith(CONNECTION_REPLACED_CODE, 'Replaced by a newer connection');
    expect(FakeSocket.all.length).toBe(1);
    expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
  });

  it('disconnecting stops a reconnect that was waiting', async () => {
    const socket = await connected(client);
    socket.closed(1006);
    client.disconnect();

    await wait(30);
    expect(FakeSocket.all.length).toBe(1);
  });
});

describe('MatchConnection', () => {
  const storage = new Map<string, string>();
  const realSessionStorage = (globalThis as any).sessionStorage;

  beforeEach(() => {
    storage.clear();
    (globalThis as any).sessionStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    };
    FakeSocket.onCreate = socket => setTimeout(() => socket.open(), 0);
  });

  afterEach(() => {
    (globalThis as any).sessionStorage = realSessionStorage;
  });

  const events: MatchConnectionEvents = {
    getChampionId: () => 'warrior',
    getSummonerSpells: () => [],
    onStatusChange: () => {},
    onQueueEntered: () => {},
    onDisconnect: () => {},
    onLatencyUpdate: () => {},
    onError: () => {},
    onGameStart: () => {},
    onQueueJoined: () => {},
  };

  it('connecting again closes the previous client\'s socket first', async () => {
    const connection = new MatchConnection('ws://test/ws');
    connection.connect('practice', undefined, events, { size: 1, map: 'vale' });
    await wait(5);
    const first = connection.getNetworkClient();
    connection.connect('practice', undefined, events, { size: 1, map: 'vale' });
    await wait(5);

    expect(FakeSocket.all.length).toBe(2);
    expect(FakeSocket.open().length).toBe(1);
    expect(first?.getState()).toBe(ConnectionState.DISCONNECTED);
    // Only the new socket said READY for the player
    expect(FakeSocket.all[1].sent.filter(message => message.type === 2).length).toBe(1);
    connection.disconnect();
  });
});
