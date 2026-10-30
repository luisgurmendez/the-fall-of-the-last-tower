/**
 * MatchmakingUI - Controls the matchmaking overlay screens.
 *
 * Manages:
 * - Main menu
 * - Champion select
 * - Connecting to server
 * - Queue status
 * - Match found display
 * - Loading progress
 * - Error handling
 */

import { NetworkClient } from "../../../packages/client/src/network/NetworkClient";
import {
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  ABILITY_DEFINITIONS,
} from "@siege/shared";
import type {
  ScreenId,
  ConnectionStatus,
  MatchData,
  MatchmakingUICallbacks,
} from "./types";
import {
  ChampionSelect,
  CHAMPION_ICONS,
  ENABLED_CHAMPIONS,
} from "./championSelect";
import { QueueScreen } from "./queueScreen";
import { startTipRotation, showRandomTip } from "./tips";
// Re-export for external use
export type {
  ScreenId,
  ConnectionStatus,
  MatchData,
  MatchmakingUICallbacks,
} from "./types";

// Debug: verify imports
console.log("[MatchmakingUI] Module loaded");
console.log("[MatchmakingUI] getAbilityDefinition:", typeof getAbilityDefinition);
console.log("[MatchmakingUI] ABILITY_DEFINITIONS:", ABILITY_DEFINITIONS);
console.log("[MatchmakingUI] Test lookup warrior_slash:", getAbilityDefinition("warrior_slash"));

/**
 * MatchmakingUI class.
 */
export class MatchmakingUI {
  // DOM Elements
  private overlay: HTMLElement;
  private screens: Map<ScreenId, HTMLElement> = new Map();

  // Status elements
  private statusDot: HTMLElement;
  private statusText: HTMLElement;
  private pingValue: HTMLElement;
  private tipText: HTMLElement;

  // Queue screen
  private queue: QueueScreen;

  // Match found elements
  private blueChampion: HTMLElement;
  private redChampion: HTMLElement;
  private loadingBar: HTMLElement;

  // Error elements
  private errorMessage: HTMLElement;

  // Champion select screen
  private championSelect: ChampionSelect;

  // Network
  private networkClient: NetworkClient | null = null;
  private serverUrl: string;
  private playerId: string;

  // State
  private currentScreen: ScreenId = "menu";
  private loadingProgress: number = 0;
  private matchData: MatchData | null = null;
  private bufferedFullState: any = null;
  private bufferedStateUpdates: any[] = [];
  /** About 30 seconds of updates at 30 Hz */
  private static readonly MAX_BUFFERED_UPDATES = 900;

  // Callbacks
  private callbacks: MatchmakingUICallbacks;

  constructor(
    serverUrl: string = "ws://localhost:8080/ws",
    callbacks: MatchmakingUICallbacks = {},
  ) {
    this.serverUrl = serverUrl;
    this.playerId = this.generatePlayerId();
    this.callbacks = callbacks;

    // Get DOM elements - use safe getter that won't crash if element missing
    const getEl = (id: string) => document.getElementById(id) as HTMLElement;

    this.overlay = getEl("matchmaking-overlay");

    // Get screens
    this.screens.set("menu", getEl("screen-menu"));
    this.screens.set("champion-select", getEl("screen-champion-select"));
    this.screens.set("connecting", getEl("screen-connecting"));
    this.screens.set("queue", getEl("screen-queue"));
    this.screens.set("match-found", getEl("screen-match-found"));
    this.screens.set("error", getEl("screen-error"));

    // Get status elements
    this.statusDot = getEl("status-dot");
    this.statusText = getEl("status-text");
    this.pingValue = getEl("ping-value");
    this.tipText = getEl("tip-text");

    // Get queue elements
    this.queue = new QueueScreen(getEl);

    // Get match found elements
    this.blueChampion = getEl("blue-champion");
    this.redChampion = getEl("red-champion");
    this.loadingBar = getEl("loading-bar");

    // Get error elements
    this.errorMessage = getEl("error-message");

    // Get champion select elements
    this.championSelect = new ChampionSelect(getEl);

    // Warn if critical elements missing
    if (!this.overlay) {
      console.warn(
        "[MatchmakingUI] Matchmaking overlay element not found in DOM",
      );
      return;
    }

    // Setup champion select
    this.championSelect.setup();

    // Setup event listeners
    this.setupEventListeners();

    // Start tip rotation
    startTipRotation(this.tipText);

    // Show random tip
    showRandomTip(this.tipText);
  }

  /**
   * Generate a unique player ID.
   * Uses sessionStorage so each tab/window gets a unique ID.
   */
  private generatePlayerId(): string {
    const stored = sessionStorage.getItem("siege-player-id");
    if (stored) return stored;

    const id = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("siege-player-id", id);
    return id;
  }

  /**
   * Lock in the selected champion and proceed to matchmaking.
   */
  private lockInChampion(): void {
    if (!this.championSelect.getSelectedChampionId()) return;

    // Start matchmaking with selected champion
    this.startMatchmaking("queue");
  }

  /**
   * Start a practice match against a bot with the selected champion.
   */
  private startPractice(): void {
    if (!this.championSelect.getSelectedChampionId()) return;

    // Bot plays a random enabled champion
    const botChampionId =
      ENABLED_CHAMPIONS[
        Math.floor(Math.random() * ENABLED_CHAMPIONS.length)
      ];
    this.startMatchmaking("practice", botChampionId);
  }

  /**
   * Setup button event listeners.
   */
  private setupEventListeners(): void {
    // Play button - go to champion select
    document.getElementById("btn-play")?.addEventListener("click", () => {
      this.showScreen("champion-select");
    });

    // Back button - return to menu
    document.getElementById("btn-back-menu")?.addEventListener("click", () => {
      this.showScreen("menu");
    });

    // Lock-in button - proceed to matchmaking
    document.getElementById("btn-lock-in")?.addEventListener("click", () => {
      this.lockInChampion();
    });

    // Practice button - start a match against a bot
    document.getElementById("btn-practice")?.addEventListener("click", () => {
      this.startPractice();
    });

    // Cancel connect button
    document
      .getElementById("btn-cancel-connect")
      ?.addEventListener("click", () => {
        this.cancelConnection();
      });

    // Cancel queue button
    document
      .getElementById("btn-cancel-queue")
      ?.addEventListener("click", () => {
        this.cancelQueue();
      });

    // Retry button
    document.getElementById("btn-retry")?.addEventListener("click", () => {
      this.showScreen("menu");
    });

    // Settings button (placeholder)
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      console.log("Settings clicked");
    });

    // How to play button (placeholder)
    document
      .getElementById("btn-how-to-play")
      ?.addEventListener("click", () => {
        console.log("How to play clicked");
      });
  }

  /**
   * Show a specific screen.
   */
  private showScreen(screenId: ScreenId): void {
    // Hide all screens
    for (const element of this.screens.values()) {
      element?.classList.remove("active");
    }

    // Show requested screen
    const screen = this.screens.get(screenId);
    if (screen) {
      screen.classList.add("active");
      this.currentScreen = screenId;
    }

    // Toggle champion-select mode class on container for CSS targeting
    const container = this.overlay?.querySelector(".matchmaking-container");
    if (container) {
      if (screenId === "champion-select") {
        container.classList.add("champion-select-mode");
      } else {
        container.classList.remove("champion-select-mode");
      }
    }
  }

  /**
   * Update connection status display.
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    if (this.statusDot) {
      this.statusDot.className = "status-dot " + status;
    }

    if (this.statusText) {
      switch (status) {
        case "offline":
          this.statusText.textContent = "Offline";
          break;
        case "connecting":
          this.statusText.textContent = "Connecting...";
          break;
        case "online":
          this.statusText.textContent = "Online";
          break;
      }
    }
  }

  /**
   * Update ping display.
   */
  private updatePing(ping: number): void {
    if (this.pingValue) {
      this.pingValue.textContent = ping.toString();
    }
  }

  /**
   * Start matchmaking process.
   */
  private startMatchmaking(
    mode: "queue" | "practice",
    botChampionId?: string,
  ): void {
    this.showScreen("connecting");
    this.updateConnectionStatus("connecting");

    // Create network client
    this.networkClient = new NetworkClient({
      serverUrl: this.serverUrl,
      playerId: this.playerId,
      gameId: "", // Will be assigned by server
      sessionToken: sessionStorage.getItem("siege-session-token") ?? undefined,
    });

    // Setup event handlers
    this.networkClient.onConnect = () => {
      console.log("[MatchmakingUI] Connected to server");
      this.updateConnectionStatus("online");

      // Send ready message to join queue with selected champion
      console.log(
        `[MatchmakingUI] Sending ready with selectedChampionId="${this.championSelect.getSelectedChampionId()}"`,
      );
      this.networkClient?.sendReady(this.championSelect.getSelectedChampionId(), {
        mode,
        botChampionId,
      });
      if (mode === "queue") {
        this.showScreen("queue");
        this.queue.startTimer();
      }
    };

    this.networkClient.onDisconnect = (code, reason) => {
      console.log(`[MatchmakingUI] Disconnected: ${code} - ${reason}`);
      this.updateConnectionStatus("offline");

      if (
        this.currentScreen !== "menu" &&
        this.currentScreen !== "champion-select"
      ) {
        this.showError("Connection lost. Please try again.");
      }
    };

    this.networkClient.onLatencyUpdate = (latency) => {
      this.updatePing(latency);
    };

    this.networkClient.onError = (error) => {
      console.error("[MatchmakingUI] Error:", error);
      this.showError(error);
    };

    this.networkClient.onGameStart = (data: any) => {
      console.log("[MatchmakingUI] Game starting:", data);
      this.handleMatchFound(data);
    };

    this.networkClient.onFullState = (snapshot: any) => {
      // Buffer the full state so OnlineGame can process it after initialization
      // This is needed because FULL_STATE is sent immediately after GAME_START,
      // but OnlineGame isn't created until after the loading animation
      console.log(
        "[MatchmakingUI] Buffering full state:",
        snapshot?.entities?.length || 0,
        "entities",
      );
      this.bufferedFullState = snapshot;
      // Updates from before this full state are already included in it
      this.bufferedStateUpdates = [];
    };

    this.networkClient.onStateUpdate = (update: any) => {
      // Keep the deltas that arrive during the loading screen: the server
      // won't resend what they changed, so OnlineGame replays them after
      // the full state (see getBufferedStateUpdates)
      if (this.bufferedStateUpdates.length < MatchmakingUI.MAX_BUFFERED_UPDATES) {
        this.bufferedStateUpdates.push(update);
      }
    };

    // Handle custom events (session, queue joined, etc.)
    this.networkClient.onEvent = (event) => {
      if (event.event === "session") {
        // Persist so the player can rejoin their game after a page reload
        sessionStorage.setItem("siege-session-token", event.sessionToken);
      } else if (event.event === "queue_joined") {
        this.queue.updateInfo(event.position, event.queueSize);
      }
    };

    // Connect to server
    this.networkClient.connect();
  }

  /**
   * Cancel connection attempt.
   */
  private cancelConnection(): void {
    this.networkClient?.disconnect();
    this.networkClient = null;
    this.updateConnectionStatus("offline");
    this.showScreen("champion-select");
  }

  /**
   * Cancel queue.
   */
  private cancelQueue(): void {
    this.queue.stopTimer();
    this.networkClient?.disconnect();
    this.networkClient = null;
    this.updateConnectionStatus("offline");
    this.showScreen("champion-select");
  }

  /**
   * Handle match found from server.
   */
  private handleMatchFound(data: any): void {
    this.queue.stopTimer();
    this.matchData = data;

    // Update team displays
    const bluePlayer = data.players?.find((p: any) => p.side === 0);
    const redPlayer = data.players?.find((p: any) => p.side === 1);

    if (this.blueChampion) {
      const championName = this.formatChampionName(
        bluePlayer?.championId || "warrior",
      );
      const icon = CHAMPION_ICONS[bluePlayer?.championId || "warrior"] || "⚔️";
      this.blueChampion.textContent = `${icon} ${championName}`;
    }
    if (this.redChampion) {
      const championName = this.formatChampionName(
        redPlayer?.championId || "warrior",
      );
      const icon = CHAMPION_ICONS[redPlayer?.championId || "warrior"] || "⚔️";
      this.redChampion.textContent = `${icon} ${championName}`;
    }

    // Show match found screen
    this.showScreen("match-found");

    // Start loading animation
    this.startLoadingAnimation();
  }

  /**
   * Format champion name for display.
   */
  private formatChampionName(id: string): string {
    const champion = CHAMPION_DEFINITIONS[id];
    return champion?.name || id.charAt(0).toUpperCase() + id.slice(1);
  }

  /**
   * Start loading animation.
   */
  private startLoadingAnimation(): void {
    this.loadingProgress = 0;
    if (this.loadingBar) {
      this.loadingBar.style.width = "0%";
    }

    const loadingInterval = setInterval(() => {
      this.loadingProgress += Math.random() * 15 + 5;

      if (this.loadingProgress >= 100) {
        this.loadingProgress = 100;
        if (this.loadingBar) this.loadingBar.style.width = "100%";
        clearInterval(loadingInterval);

        // Transition to game
        setTimeout(() => {
          this.startGame();
        }, 500);
      } else {
        if (this.loadingBar)
          this.loadingBar.style.width = `${this.loadingProgress}%`;
      }
    }, 200);
  }

  /**
   * Start the game.
   */
  private startGame(): void {
    // Hide overlay
    this.hide();

    // Notify callback
    if (this.matchData) {
      this.callbacks.onGameStart?.(this.matchData);
    }

    this.callbacks.onGameReady?.();
  }

  /**
   * Show error screen.
   */
  private showError(message: string): void {
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
    }
    this.showScreen("error");
    this.queue.stopTimer();
  }

  /**
   * Show the overlay.
   */
  show(): void {
    this.overlay?.classList.remove("hidden");
    this.showScreen("menu");
  }

  /**
   * Hide the overlay.
   */
  hide(): void {
    this.overlay?.classList.add("hidden");
  }

  /**
   * Check if overlay is visible.
   */
  isVisible(): boolean {
    return this.overlay ? !this.overlay.classList.contains("hidden") : false;
  }

  /**
   * Get the network client (for game to use).
   */
  getNetworkClient(): NetworkClient | null {
    return this.networkClient;
  }

  /**
   * Get match data.
   */
  getMatchData(): MatchData | null {
    return this.matchData;
  }

  /**
   * Get selected champion ID.
   */
  getSelectedChampionId(): string {
    return this.championSelect.getSelectedChampionId();
  }

  /**
   * Get the buffered full state (sent by server immediately after GAME_START).
   * Returns null if no state has been received.
   */
  getBufferedFullState(): any {
    return this.bufferedFullState;
  }

  /**
   * Clear the buffered full state after it has been processed.
   */
  clearBufferedFullState(): void {
    this.bufferedFullState = null;
  }

  /**
   * State updates received after the buffered full state, in order. Clears the buffer.
   */
  takeBufferedStateUpdates(): any[] {
    const updates = this.bufferedStateUpdates;
    this.bufferedStateUpdates = [];
    return updates;
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.queue.stopTimer();
    this.networkClient?.disconnect();
    this.networkClient = null;
    this.matchData = null;
    this.loadingProgress = 0;
    this.bufferedFullState = null;
    this.bufferedStateUpdates = [];
    this.updateConnectionStatus("offline");
    this.showScreen("menu");
  }
}
