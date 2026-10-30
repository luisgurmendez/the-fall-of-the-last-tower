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
 *
 * MatchmakingUI is the coordinator: it switches screens, wires the buttons,
 * shows the connection status, ping and errors, and starts the game when
 * loading ends. The screens and the network wiring live next to it:
 * - championSelect.ts: champion grid, detail panel and the selected champion
 * - abilityCards.ts, abilityText.ts: ability and passive cards; their
 *   tooltip text and scaling previews
 * - queueScreen.ts: queue timer, position and size
 * - matchFound.ts: each team's champion and the loading bar
 * - matchConnection.ts: NetworkClient setup, player ID and session token,
 *   and the full state and updates buffered for OnlineGame
 * - tips.ts: rotating gameplay tips
 * - types.ts: screen, status, match data and callback types (re-exported here)
 */

import type { NetworkClient } from "../../../packages/client/src/network/NetworkClient";
import {
  getAbilityDefinition,
  ABILITY_DEFINITIONS,
} from "@siege/shared";
import type {
  ScreenId,
  ConnectionStatus,
  MatchData,
  MatchmakingUICallbacks,
} from "./types";
import { ChampionSelect, ENABLED_CHAMPIONS } from "./championSelect";
import { MatchConnection } from "./matchConnection";
import { MatchFoundScreen } from "./matchFound";
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

  // Match found screen
  private matchFound: MatchFoundScreen;

  // Error elements
  private errorMessage: HTMLElement;

  // Champion select screen
  private championSelect: ChampionSelect;

  // Network client and the state buffered for OnlineGame
  private connection: MatchConnection;

  // State
  private currentScreen: ScreenId = "menu";
  private matchData: MatchData | null = null;

  // Callbacks
  private callbacks: MatchmakingUICallbacks;

  constructor(
    serverUrl: string = "ws://localhost:8080/ws",
    callbacks: MatchmakingUICallbacks = {},
  ) {
    this.connection = new MatchConnection(serverUrl);
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
    this.matchFound = new MatchFoundScreen(getEl);

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

    this.connection.connect(mode, botChampionId, {
      getChampionId: () => this.championSelect.getSelectedChampionId(),
      onStatusChange: (status) => this.updateConnectionStatus(status),
      onQueueEntered: () => {
        this.showScreen("queue");
        this.queue.startTimer();
      },
      onDisconnect: () => {
        if (
          this.currentScreen !== "menu" &&
          this.currentScreen !== "champion-select"
        ) {
          this.showError("Connection lost. Please try again.");
        }
      },
      onLatencyUpdate: (latency) => this.updatePing(latency),
      onError: (error) => this.showError(error),
      onGameStart: (data) => this.handleMatchFound(data),
      onQueueJoined: (position, queueSize) =>
        this.queue.updateInfo(position, queueSize),
    });
  }

  /**
   * Cancel connection attempt.
   */
  private cancelConnection(): void {
    this.connection.disconnect();
    this.updateConnectionStatus("offline");
    this.showScreen("champion-select");
  }

  /**
   * Cancel queue.
   */
  private cancelQueue(): void {
    this.queue.stopTimer();
    this.connection.disconnect();
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
    this.matchFound.showTeams(data);

    // Show match found screen
    this.showScreen("match-found");

    // Start loading animation
    this.matchFound.startLoadingAnimation(() => this.startGame());
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
    return this.connection.getNetworkClient();
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
    return this.connection.getBufferedFullState();
  }

  /**
   * Clear the buffered full state after it has been processed.
   */
  clearBufferedFullState(): void {
    this.connection.clearBufferedFullState();
  }

  /**
   * State updates received after the buffered full state, in order. Clears the buffer.
   */
  takeBufferedStateUpdates(): any[] {
    return this.connection.takeBufferedStateUpdates();
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.queue.stopTimer();
    this.connection.disconnect();
    this.matchData = null;
    this.matchFound.resetProgress();
    this.connection.clearBufferedState();
    this.updateConnectionStatus("offline");
    this.showScreen("menu");
  }
}
