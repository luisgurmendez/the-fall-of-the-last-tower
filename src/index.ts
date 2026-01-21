import OnlineGame from "./core/OnlineGame";
import { BitmapFont } from "./render/BitmapFont";
import { MatchmakingUI, type MatchData } from "./ui/matchmaking/MatchmakingUI";

// Get server URL from environment or default
function getServerUrl(): string {
  // Check for query param override
  const params = new URLSearchParams(window.location.search);
  const serverParam = params.get('server');
  if (serverParam) return serverParam;

  // Default to localhost for development
  return 'ws://localhost:8080/ws';
}

async function startOnlineGame(matchData: MatchData, matchmakingUI: MatchmakingUI) {
  console.log('[Game] Starting online game with match data:', matchData);

  // Get the network client from matchmaking UI
  const networkClient = matchmakingUI.getNetworkClient();
  if (!networkClient) {
    console.error('[Game] No network client available');
    return;
  }

  // Create online game with the existing network client
  const game = new OnlineGame({
    networkClient,
    matchData,
  });

  (window as any).g = game;
  (window as any).networkClient = networkClient;
  (window as any).matchData = matchData;

  game.init();

  // Process any buffered full state from before OnlineGame was created
  // This is needed because FULL_STATE is sent immediately after GAME_START,
  // but OnlineGame isn't created until after the loading animation
  const bufferedFullState = matchmakingUI.getBufferedFullState();
  if (bufferedFullState) {
    console.log('[Game] Processing buffered full state:', bufferedFullState.entities?.length || 0, 'entities');
    game.getStateManager().processFullState(bufferedFullState);
    matchmakingUI.clearBufferedFullState();
  } else {
    console.warn('[Game] No buffered full state available - entities may not appear immediately');
  }

  const init = game.loop();
  init();

  // Handle game end - show matchmaking UI again
  networkClient.onGameEnd = (data: any) => {
    console.log('[Game] Game ended:', data);
    matchmakingUI.reset();
    matchmakingUI.show();
  };

  networkClient.onDisconnect = (code: number, reason: string) => {
    console.log('[Game] Disconnected:', code, reason);
    matchmakingUI.reset();
    matchmakingUI.show();
  };
}

async function main() {
  console.log('[Main] Starting initialization...');

  // Load bitmap fonts
  try {
    await BitmapFont.loadFonts();
    console.log("[Main] Bitmap fonts loaded!");
  } catch (e) {
    console.warn("[Main] Failed to load bitmap fonts, falling back to system fonts:", e);
  }

  // Initialize matchmaking UI for online play
  const serverUrl = getServerUrl();
  console.log(`[Main] Server URL: ${serverUrl}`);

  const matchmakingUI = new MatchmakingUI(serverUrl, {
    onGameStart: (matchData) => {
      console.log('[Main] Game starting with match data:', matchData);
      startOnlineGame(matchData, matchmakingUI);
    },
    onGameReady: () => {
      console.log('[Main] Game ready, hiding UI');
    }
  });

  // Show the matchmaking UI
  matchmakingUI.show();

  // Expose for debugging
  (window as any).matchmakingUI = matchmakingUI;
}

// Wait for DOM to be fully ready before initializing
console.log('[Boot] Script loaded, readyState:', document.readyState);

// readyState can be: 'loading', 'interactive', or 'complete'
// 'interactive' means DOM is still being constructed - elements may not exist yet
// We need to wait for 'complete' or DOMContentLoaded event
if (document.readyState === 'complete') {
  console.log('[Boot] DOM complete, calling main() immediately');
  main();
} else {
  console.log('[Boot] Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Boot] DOMContentLoaded fired, calling main()');
    main();
  });
}
