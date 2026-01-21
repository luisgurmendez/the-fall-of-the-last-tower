/**
 * Test Client - Simple WebSocket client to test the server.
 *
 * Usage:
 *   bun run src/test-client.ts [playerId]
 *
 * This will connect to the server and join the matchmaking queue.
 */

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080/ws';
const PLAYER_ID = process.argv[2] || `player-${Date.now()}`;

console.log(`[TestClient] Connecting as ${PLAYER_ID} to ${SERVER_URL}`);

const ws = new WebSocket(SERVER_URL);

ws.onopen = () => {
  console.log('[TestClient] Connected!');

  // Send READY message to join matchmaking
  const readyMessage = {
    type: 2, // ClientMessageType.READY
    data: {
      playerId: PLAYER_ID,
      championId: 'warrior',
    },
  };

  ws.send(JSON.stringify(readyMessage));
  console.log('[TestClient] Sent READY message, joining queue...');
};

ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data as string);
    console.log(`[TestClient] Received:`, JSON.stringify(message, null, 2));

    // If game started, send a test input
    if (message.type === 5) { // ServerMessageType.GAME_START
      console.log('[TestClient] Game started! Sending test move input...');

      // Send a move input after 1 second
      setTimeout(() => {
        const moveInput = {
          type: 0, // ClientMessageType.INPUT
          data: {
            seq: 1,
            type: 0, // InputType.MOVE
            clientTime: Date.now(),
            targetX: 500,
            targetY: 500,
          },
        };

        ws.send(JSON.stringify(moveInput));
        console.log('[TestClient] Sent move input to (500, 500)');
      }, 1000);
    }

    // If state update received
    if (message.type === 1) { // ServerMessageType.STATE_UPDATE
      const entityCount = message.data?.deltas?.length || 0;
      console.log(`[TestClient] State update: tick=${message.data?.tick}, entities=${entityCount}`);
    }
  } catch (error) {
    console.log('[TestClient] Raw message:', event.data);
  }
};

ws.onerror = (error) => {
  console.error('[TestClient] Error:', error);
};

ws.onclose = (event) => {
  console.log(`[TestClient] Disconnected (code=${event.code}, reason=${event.reason})`);
};

// Keep process alive
console.log('[TestClient] Press Ctrl+C to exit');

process.on('SIGINT', () => {
  console.log('\n[TestClient] Closing connection...');
  ws.close();
  process.exit(0);
});
