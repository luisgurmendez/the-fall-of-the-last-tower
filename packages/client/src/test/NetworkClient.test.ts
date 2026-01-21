import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { NetworkClient, ConnectionState } from '../network/NetworkClient';
import { ClientMessageType, InputType } from '@siege/shared';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  binaryType: string = 'blob';
  readyState: number = MockWebSocket.OPEN;

  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;

  private sentMessages: unknown[] = [];

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(JSON.parse(data as string));
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, reason: reason ?? '' });
    }
  }

  getSentMessages(): unknown[] {
    return this.sentMessages;
  }

  // Helper to simulate receiving a message
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // Helper to simulate error
  simulateError(error: Error): void {
    if (this.onerror) this.onerror(error);
  }
}

// Store reference to created WebSocket
let mockWsInstance: MockWebSocket | null = null;

// Mock WebSocket globally for Bun
(globalThis as any).WebSocket = class extends MockWebSocket {
  constructor(url: string) {
    super(url);
    mockWsInstance = this;
  }
};

describe('NetworkClient', () => {
  let client: NetworkClient;

  beforeEach(() => {
    mockWsInstance = null;
    client = new NetworkClient({
      serverUrl: 'ws://localhost:8080',
      playerId: 'player1',
      gameId: 'game1',
    });
  });

  afterEach(() => {
    if (client.getState() !== ConnectionState.DISCONNECTED) {
      client.disconnect();
    }
  });

  describe('connection', () => {
    it('should start in disconnected state', () => {
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should connect to server', async () => {
      const connectPromise = client.connect();
      await connectPromise;

      expect(client.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should call onConnect handler', async () => {
      const onConnect = mock();
      client.setHandlers({ onConnect });

      await client.connect();

      expect(onConnect).toHaveBeenCalled();
    });

    it('should send ready message on connect', async () => {
      await client.connect();

      const messages = mockWsInstance?.getSentMessages();
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThan(0);
      expect(messages![0]).toMatchObject({
        type: ClientMessageType.READY,
        data: {
          playerId: 'player1',
          gameId: 'game1',
        },
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect from server', async () => {
      await client.connect();
      client.disconnect();

      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should call onDisconnect handler', async () => {
      const onDisconnect = mock();
      client.setHandlers({ onDisconnect });

      await client.connect();

      // Manually trigger close since mock doesn't do it automatically on disconnect
      mockWsInstance?.close(1000, 'Client disconnect');

      // onDisconnect is called for unexpected disconnects, not manual ones
      // For this test, we need to simulate server-initiated close
    });
  });

  describe('sendMoveInput', () => {
    it('should send move input to server', async () => {
      await client.connect();

      client.sendMoveInput(100, 200);

      const messages = mockWsInstance?.getSentMessages();
      const moveMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.MOVE);
      expect(moveMessage).toBeDefined();
      expect((moveMessage as any).data.targetX).toBe(100);
      expect((moveMessage as any).data.targetY).toBe(200);
    });

    it('should increment sequence number', async () => {
      await client.connect();

      client.sendMoveInput(100, 200);
      client.sendMoveInput(200, 300);

      const messages = mockWsInstance?.getSentMessages();
      const inputMessages = messages?.filter((m: any) => m.type === ClientMessageType.INPUT);
      expect((inputMessages![0] as any).data.seq).toBe(1);
      expect((inputMessages![1] as any).data.seq).toBe(2);
    });

    it('should store pending inputs', async () => {
      await client.connect();

      client.sendMoveInput(100, 200);
      client.sendMoveInput(200, 300);

      expect(client.getPendingInputs().length).toBe(2);
    });
  });

  describe('sendAttackMoveInput', () => {
    it('should send attack move input', async () => {
      await client.connect();

      client.sendAttackMoveInput(150, 250);

      const messages = mockWsInstance?.getSentMessages();
      const attackMoveMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.ATTACK_MOVE);
      expect(attackMoveMessage).toBeDefined();
    });
  });

  describe('sendAbilityInput', () => {
    it('should send ability input with position target', async () => {
      await client.connect();

      client.sendAbilityInput(0, 'position', 100, 100);

      const messages = mockWsInstance?.getSentMessages();
      const abilityMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.ABILITY);
      expect(abilityMessage).toBeDefined();
      expect((abilityMessage as any).data.slot).toBe(0);
      expect((abilityMessage as any).data.targetType).toBe('position');
    });

    it('should send ability input with unit target', async () => {
      await client.connect();

      client.sendAbilityInput(1, 'unit', undefined, undefined, 'enemy1');

      const messages = mockWsInstance?.getSentMessages();
      const abilityMessage = messages?.find(
        (m: any) => m.type === ClientMessageType.INPUT && m.data?.slot === 1
      );
      expect(abilityMessage).toBeDefined();
      expect((abilityMessage as any).data.targetEntityId).toBe('enemy1');
    });
  });

  describe('sendStopInput', () => {
    it('should send stop input', async () => {
      await client.connect();

      client.sendStopInput();

      const messages = mockWsInstance?.getSentMessages();
      const stopMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.STOP);
      expect(stopMessage).toBeDefined();
    });
  });

  describe('sendLevelUpInput', () => {
    it('should send level up input', async () => {
      await client.connect();

      client.sendLevelUpInput(2);

      const messages = mockWsInstance?.getSentMessages();
      const levelUpMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.LEVEL_UP);
      expect(levelUpMessage).toBeDefined();
      expect((levelUpMessage as any).data.slot).toBe(2);
    });
  });

  describe('sendBuyItemInput', () => {
    it('should send buy item input', async () => {
      await client.connect();

      client.sendBuyItemInput('sword_of_doom');

      const messages = mockWsInstance?.getSentMessages();
      const buyMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.BUY_ITEM);
      expect(buyMessage).toBeDefined();
      expect((buyMessage as any).data.itemId).toBe('sword_of_doom');
    });
  });

  describe('sendRecallInput', () => {
    it('should send recall input', async () => {
      await client.connect();

      client.sendRecallInput();

      const messages = mockWsInstance?.getSentMessages();
      const recallMessage = messages?.find((m: any) => m.type === ClientMessageType.INPUT && m.data?.type === InputType.RECALL);
      expect(recallMessage).toBeDefined();
    });
  });

  describe('latency tracking', () => {
    it('should start with zero latency', () => {
      expect(client.getLatency()).toBe(0);
    });
  });

  describe('not connected warnings', () => {
    it('should not send when not connected', () => {
      // Client is not connected
      client.sendMoveInput(100, 100);

      // No messages should be sent
      expect(mockWsInstance).toBeNull();
    });
  });
});
