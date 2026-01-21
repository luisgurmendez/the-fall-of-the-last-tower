import Game from "./core/game";
import OnlineGame from "./core/OnlineGame";
import { BitmapFont } from "./render/BitmapFont";
import { createMapBuilderUI } from "./mapBuilder";
import { MatchmakingUI, type MatchData } from "./ui/matchmaking/MatchmakingUI";

/**
 * Application modes based on URL hash:
 * - #builder: Map Builder mode
 * - #play-custom: Play custom map from localStorage
 * - #offline: Offline single-player mode (original behavior)
 * - (default): Online multiplayer with matchmaking
 */
type AppMode = 'online' | 'offline' | 'builder' | 'play-custom';

function getAppMode(): AppMode {
  const hash = window.location.hash;
  if (hash === '#builder') return 'builder';
  if (hash === '#play-custom') return 'play-custom';
  if (hash === '#offline') return 'offline';
  return 'online';
}

// Get server URL from environment or default
function getServerUrl(): string {
  // Check for query param override
  const params = new URLSearchParams(window.location.search);
  const serverParam = params.get('server');
  if (serverParam) return serverParam;

  // Default to localhost for development
  return 'ws://localhost:8080/ws';
}

async function startOfflineGame(customMapKey?: string) {
  const game = new Game(customMapKey);
  (window as any).g = game;
  game.init();
  const init = game.loop();
  init();
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

async function startBuilder() {
  // Hide matchmaking overlay for builder mode
  const overlay = document.getElementById('matchmaking-overlay');
  if (overlay) overlay.classList.add('hidden');

  // Create builder container
  const container = document.getElementById('app') || document.body;
  container.innerHTML = '';

  const builderContainer = document.createElement('div');
  builderContainer.id = 'builder-root';
  builderContainer.style.width = '100%';
  builderContainer.style.height = '100vh';
  container.appendChild(builderContainer);

  // Initialize map builder
  const { builder } = createMapBuilderUI(builderContainer);
  (window as any).mapBuilder = builder;

  console.log('Map Builder initialized. Use the toolbar to create your map.');
}

async function main() {
  console.log('[Main] Starting initialization...');
  console.log('[Main] Document readyState:', document.readyState);
  console.log('[Main] matchmaking-overlay element:', document.getElementById('matchmaking-overlay'));

  // Load bitmap fonts
  try {
    await BitmapFont.loadFonts();
    console.log("[Main] Bitmap fonts loaded!");
  } catch (e) {
    console.warn("[Main] Failed to load bitmap fonts, falling back to system fonts:", e);
  }

  const mode = getAppMode();
  console.log(`[Main] Starting in ${mode} mode`);

  switch (mode) {
    case 'builder':
      await startBuilder();
      break;

    case 'play-custom':
      // Hide matchmaking overlay for custom map play
      document.getElementById('matchmaking-overlay')?.classList.add('hidden');
      await startOfflineGame('customMap');
      break;

    case 'offline':
      // Hide matchmaking overlay for offline mode
      document.getElementById('matchmaking-overlay')?.classList.add('hidden');
      await startOfflineGame();
      break;

    case 'online':
    default:
      // Initialize matchmaking UI for online play
      console.log('[Main] Online mode - initializing matchmaking UI');
      console.log('[Main] All screen elements:', {
        menu: document.getElementById('screen-menu'),
        connecting: document.getElementById('screen-connecting'),
        queue: document.getElementById('screen-queue'),
        matchFound: document.getElementById('screen-match-found'),
        error: document.getElementById('screen-error'),
      });

      const serverUrl = getServerUrl();
      console.log(`[Main] Server URL: ${serverUrl}`);

      console.log('[Main] Creating MatchmakingUI...');
      const matchmakingUI = new MatchmakingUI(serverUrl, {
        onGameStart: (matchData) => {
          console.log('[Main] Game starting with match data:', matchData);
          startOnlineGame(matchData, matchmakingUI);
        },
        onGameReady: () => {
          console.log('[Main] Game ready, hiding UI');
        }
      });
      console.log('[Main] MatchmakingUI created');

      // Show the matchmaking UI
      console.log('[Main] Calling matchmakingUI.show()');
      matchmakingUI.show();
      console.log('[Main] matchmakingUI.show() called, isVisible:', matchmakingUI.isVisible());

      // Expose for debugging
      (window as any).matchmakingUI = matchmakingUI;
      break;
  }

  // Listen for hash changes to switch modes
  window.addEventListener('hashchange', () => {
    window.location.reload();
  });
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
