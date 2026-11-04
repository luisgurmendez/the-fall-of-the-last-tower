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
import { GameConfig, MOBAConfig, getChampionDefinition } from '@siege/shared';
import { GameMenu } from '@/ui/GameMenu';
import { DebugOverlay } from '@/debug/DebugOverlay';
import type { NetworkClient } from '@siege/client';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import type { GameApi } from './gameContext';
import { getControls } from '@/core/input/controls';
import { normalizeKey } from '@/core/input/keyBindings';

/**
 * Configuration for online game.
 */
export interface OnlineGameConfig {
  networkClient: NetworkClient;
  matchData: MatchData;
  /** The player is done with the final scoreboard */
  onLeaveResults?: () => void;
}

/**
 * OnlineGame runs the game loop with server-authoritative state.
 * Note: No pause functionality - real-time multiplayer games can't be paused client-side.
 */
class OnlineGame {
  /** The Escape menu (resume, surrender) */
  private gameMenu!: GameMenu;
  /** F3: what the server thinks about the units in sight (practice matches) */
  private readonly debugOverlay: DebugOverlay;
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

    this.debugOverlay = new DebugOverlay(this.networkClient, this.stateManager);
    this.networkClient.onDebugState = (data) => this.debugOverlay.receive(data);

    // Initialize level for online play
    this.level = generateOnlineLevel({
      networkClient: this.networkClient,
      stateManager: this.stateManager,
      matchData: this.matchData,
      debugOverlay: this.debugOverlay,
      onLeaveResults: config.onLeaveResults,
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

    this.gameMenu = new GameMenu(() => this.networkClient.sendSurrender(), this.debugOverlay);

    // Wire up shop to network client for online buy/sell
    const shopUI = getShopUI();
    shopUI.setNetworkClient(this.networkClient);

    window.addEventListener('keydown', (e) => {
      // P (the shop key) toggles the shop
      if (normalizeKey(e.key) === getControls().keyFor('shop')) {
        shopUI.toggle();
      }

      // Escape closes the shop, or opens the menu (no pause in online mode)
      if (e.key === 'Escape') {
        if (shopUI.isOpen()) {
          shopUI.close();
        } else {
          this.gameMenu.toggle();
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
      this.stateManager.advance();
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

    // The local champion's snapshot, kept aside while it's dead (it can still shop)
    const championSnapshot = this.stateManager.getChampionSnapshot(this.stateManager.getLocalEntityId());
    if (!championSnapshot) return;

    // Update shop with gold and items from server
    const items = championSnapshot.items.map(item =>
      item ? { definitionId: item.definitionId, charges: item.charges } : null
    );

    // The server only sells at the fountain, or anywhere while dead
    const fountain = championSnapshot.side === 0 ? MOBAConfig.CHAMPION_SPAWN.BLUE : MOBAConfig.CHAMPION_SPAWN.RED;
    const atShop = !GameConfig.ECONOMY.SHOP_ONLY_AT_BASE || championSnapshot.isDead ||
      Math.hypot(championSnapshot.x - fountain.x, championSnapshot.y - fountain.y) <= MOBAConfig.FOUNTAIN.RADIUS;

    shopUI.updateOnlineState(championSnapshot.gold, items, atShop, championSnapshot.controlWards ?? 0);
    const championClass = getChampionDefinition(championSnapshot.championId)?.class;
    if (championClass) shopUI.setChampion(championSnapshot.championId, championClass);
  }

  /**
   * The match is over: the in-match menu and the debug overlay go away.
   */
  onMatchEnd(): void {
    this.gameMenu.dispose();
    this.debugOverlay.dispose();
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
