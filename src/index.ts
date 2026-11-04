import OnlineGame from "./core/OnlineGame";
import { BitmapFont } from "./render/BitmapFont";
import { MatchmakingUI, type MatchData } from "./ui/matchmaking/MatchmakingUI";
import { setupFullscreenButton } from "./ui/FullscreenButton";
import { CONNECTION_REPLACED_CODE, type GameEndData } from "@siege/shared";

// Get server URL from environment or default
function getServerUrl(): string {
  // Check for query param override
  const params = new URLSearchParams(window.location.search);
  const serverParam = params.get('server');
  if (serverParam) return serverParam;

  // Check for Vite environment variable (set at build time)
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) return envUrl;

  // Served by the game server itself (production): its socket is at the same address
  if (import.meta.env?.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  // Default to localhost for development
  return 'ws://localhost:8080/ws';
}

/** How long the victory/defeat banner shows before the final scoreboard */
const GAME_END_BANNER_MS = 3000;

/** The match being played (stopped when the player leaves it or another starts) */
let currentGame: OnlineGame | null = null;

async function startOnlineGame(matchData: MatchData, matchmakingUI: MatchmakingUI) {
  console.log('[Game] Starting online game with match data:', matchData);

  // Get the network client from matchmaking UI
  const networkClient = matchmakingUI.getNetworkClient();
  if (!networkClient) {
    console.error('[Game] No network client available');
    return;
  }

  // Create online game with the existing network client; after the match,
  // its final scoreboard stays up until the player continues to the menu
  const game = new OnlineGame({
    networkClient,
    matchData,
    onLeaveResults: () => {
      game.stop();
      matchmakingUI.reset();
      matchmakingUI.show();
    },
  });
  currentGame?.stop();
  currentGame = game;

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

    // Then the deltas that arrived during the loading screen (all after the
    // full state: the buffer is cleared when one arrives), which the server
    // won't send again
    for (const update of matchmakingUI.takeBufferedStateUpdates()) {
      game.getStateManager().processStateUpdate(update);
    }
  } else {
    console.warn('[Game] No buffered full state available - entities may not appear immediately');
  }

  const init = game.loop();
  init();

  // Handle game end - announce the result, then show matchmaking UI again
  networkClient.onGameEnd = (data: GameEndData) => {
    console.log('[Game] Game ended:', data);
    game.onMatchEnd();
    const won = data.winningSide === matchData.yourSide;
    const minutes = Math.floor((data.duration ?? 0) / 60);
    const seconds = Math.floor((data.duration ?? 0) % 60).toString().padStart(2, '0');
    game.getStateManager().announce({
      text: won ? 'VICTORY' : 'DEFEAT',
      detail: `Match length ${minutes}:${seconds}`,
      color: won ? '#f1c40f' : '#e74c3c',
      duration: GAME_END_BANNER_MS,
    });

    // Then the final scoreboard and the match's stats, until the player continues
    setTimeout(() => {
      game.getStateManager().setMatchResult({ won, duration: data.duration ?? 0, players: data.players ?? [] });
    }, GAME_END_BANNER_MS);
  };

  networkClient.onDisconnect = (code: number, reason: string) => {
    console.log('[Game] Disconnected:', code, reason);
    game.stop();
    matchmakingUI.reset();
    matchmakingUI.show();
    // A newer connection of the player took the match: another tab or window
    if (code === CONNECTION_REPLACED_CODE) {
      matchmakingUI.showError('This match is open in another tab or window.');
    }
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
  setupFullscreenButton();

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
