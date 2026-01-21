/**
 * OnlineGame - Game class for multiplayer that uses server-authoritative state.
 *
 * This class:
 * - Uses NetworkClient for server communication
 * - Renders entities based on server state
 * - Sends inputs to server instead of applying locally
 */

import Clock from './clock';
import CanvasGenerator from './canvas';
import { generateOnlineLevel } from '@/levels/onlineLevel';
import { InputManager } from './input/InputManager';
import { getShopUI } from '@/ui/shop/ShopUI';
import { profiler } from '@/debug/PerformanceProfiler';
import { getCursorManager } from './CursorManager';
import { OnlineStateManager } from './OnlineStateManager';
import { EntityType, type ChampionSnapshot } from '@siege/shared';
import type { NetworkClient } from '@siege/client';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import type { GameApi } from './gameContext';

/**
 * Configuration for online game.
 */
export interface OnlineGameConfig {
  networkClient: NetworkClient;
  matchData: MatchData;
}

/**
 * OnlineGame runs the game loop with server-authoritative state.
 * Note: No pause functionality - real-time multiplayer games can't be paused client-side.
 */
class OnlineGame {
  private clock: Clock;
  private canvasRenderingContext: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private level;
  private networkClient: NetworkClient;
  private stateManager: OnlineStateManager;
  private matchData: MatchData;

  constructor(config: OnlineGameConfig) {
    this.networkClient = config.networkClient;
    this.matchData = config.matchData;

    // Create state manager to track server state
    this.stateManager = new OnlineStateManager(this.matchData);

    // Wire up network client to state manager
    this.networkClient.onStateUpdate = (update) => {
      this.stateManager.processStateUpdate(update);
      this.updateShopFromServerState();
    };

    this.networkClient.onFullState = (snapshot) => {
      this.stateManager.processFullState(snapshot);
      this.updateShopFromServerState();
    };

    // Initialize level for online play
    this.level = generateOnlineLevel({
      networkClient: this.networkClient,
      stateManager: this.stateManager,
      matchData: this.matchData,
    });

    // Initialize canvas rendering context
    const { canvas, context } = CanvasGenerator.generateCanvas();
    this.canvas = canvas;
    this.canvasRenderingContext = context;
    this.clock = new Clock();

    // Initialize input manager with canvas for mouse/keyboard events
    InputManager.getInstance().init(canvas);

    // Initialize cursor manager with canvas
    getCursorManager().init(canvas);
  }

  init() {
    // Note: No pause on blur/focus - online games continue running on server

    // Wire up shop to network client for online buy/sell
    const shopUI = getShopUI();
    shopUI.setNetworkClient(this.networkClient);

    window.addEventListener('keydown', (e) => {
      // 'P' key to toggle shop
      if (e.key === 'p' || e.key === 'P') {
        const shopUI = getShopUI();
        shopUI.toggle();
      }

      // Escape to close shop (no pause in online mode)
      if (e.key === 'Escape') {
        const shopUI = getShopUI();
        if (shopUI.isOpen()) {
          shopUI.close();
        }
      }
    });

    // Start the clock immediately
    this.clock.start();
  }

  loop = () => {
    return () => {
      profiler.beginFrame();
      this.update();
      profiler.endFrame();
      requestAnimationFrame(this.loop());
    };
  };

  private update() {
    try {
      const gameApi = this.generateGameApi();
      this.level.update(gameApi);

      // Clear "just pressed" input states at end of frame
      InputManager.getInstance().update();
    } catch (e) {
      console.error('[OnlineGame] Update error:', e);
    }
  }

  private generateGameApi(): GameApi {
    const dt = this.clock.getDelta();
    return {
      dt,
      canvasRenderingContext: this.canvasRenderingContext,
      isPaused: false, // Online games never pause client-side
      pause: () => {}, // No-op for online mode
      unPause: () => {}, // No-op for online mode
    };
  }

  /**
   * Update the shop UI with current server state.
   * Called on each state update to keep shop gold/inventory in sync.
   */
  private updateShopFromServerState(): void {
    const shopUI = getShopUI();

    // Only update if shop is open (optimization)
    if (!shopUI.isOpen()) return;

    // Get local player's champion snapshot
    const localEntity = this.stateManager.getLocalPlayerEntity();
    if (!localEntity?.snapshot) return;

    // Only champions have gold and items
    if (localEntity.snapshot.entityType !== EntityType.CHAMPION) return;

    const championSnapshot = localEntity.snapshot as ChampionSnapshot;

    // Update shop with gold and items from server
    const items = championSnapshot.items.map(item =>
      item ? { definitionId: item.definitionId } : null
    );

    shopUI.updateOnlineState(championSnapshot.gold, items);
  }

  /**
   * Get the network client instance.
   */
  getNetworkClient(): NetworkClient {
    return this.networkClient;
  }

  /**
   * Get state manager.
   */
  getStateManager(): OnlineStateManager {
    return this.stateManager;
  }

  /**
   * Get match data.
   */
  getMatchData(): MatchData {
    return this.matchData;
  }
}

export default OnlineGame;
