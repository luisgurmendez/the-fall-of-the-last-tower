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
 * - matchFound.ts, matchAssets.ts: the loading screen (a card per player)
 *   and the art it preloads for the match
 * - matchConnection.ts: NetworkClient setup, player ID and session token,
 *   and the full state and updates buffered for OnlineGame
 * - tips.ts: rotating gameplay tips
 * - types.ts: screen, status, match data and callback types (re-exported here)
 * - ../title/: the animated title screen behind the menu
 */

import type { NetworkClient } from "../../../packages/client/src/network/NetworkClient";
import type {
  ScreenId,
  ConnectionStatus,
  MatchData,
  MatchmakingUICallbacks,
} from "./types";
import { isMapId, useMap, type MapId } from "@siege/shared";
import { ChampionSelect, ENABLED_CHAMPIONS } from "./championSelect";
import { MatchConnection } from "./matchConnection";
import { MatchFoundScreen } from "./matchFound";
import { QueueScreen } from "./queueScreen";
import { SummonerPicker } from "./summonerPicker";
import { startTipRotation, showRandomTip } from "./tips";
import { TitleScreen } from "../title/TitleScreen";
import { LobbyScreen } from "./lobbyScreen";

/** The screens the title screen's valley shows behind (not champion select or the loading screen) */
const TITLE_SCREENS: ReadonlySet<ScreenId> = new Set(["menu", "how-to-play", "connecting", "queue", "lobby", "error"]);

/** Practice matches, in the order the chip beside the practice button cycles them */
const PRACTICE_MODES = [
  { label: "1V1", size: 1, map: "wildcrown", title: "1v1 in mid on Wildcrown Vale" },
  { label: "3V3", size: 3, map: "wildcrown", title: "3v3 on Wildcrown Vale: you in mid, bots in top and bot" },
  { label: "5V5", size: 5, map: "wildcrown", title: "5v5 on Wildcrown Vale: you in mid, bots in every other role" },
  { label: "ARAM", size: 1, map: "narrows", title: "1v1 on The Narrows: one lane, no jungle" },
] as const satisfies readonly { label: string; size: number; map: MapId; title: string }[];
type PracticeMode = (typeof PRACTICE_MODES)[number];
const PRACTICE_MODE_KEY = "siege-practice-mode";

function loadPracticeMode(): PracticeMode {
  try {
    const saved = localStorage.getItem(PRACTICE_MODE_KEY);
    return PRACTICE_MODES.find(mode => mode.label === saved) ?? PRACTICE_MODES[0];
  } catch {
    return PRACTICE_MODES[0];
  }
}

// Re-export for external use
export type {
  ScreenId,
  ConnectionStatus,
  MatchData,
  MatchmakingUICallbacks,
} from "./types";

/**
 * MatchmakingUI class.
 */
export class MatchmakingUI {
  // DOM Elements
  private overlay: HTMLElement;
  private screens: Map<ScreenId, HTMLElement> = new Map();
  private titleScreen: TitleScreen | null = null;

  /** The practice match the chip is on: players per team and map */
  private practiceMode: PracticeMode = loadPracticeMode();

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
  private summonerPicker: SummonerPicker;
  private lobby: LobbyScreen;

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
    this.screens.set("how-to-play", getEl("screen-how-to-play"));
    this.screens.set("lobby", getEl("screen-lobby"));
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
    this.summonerPicker = new SummonerPicker(getEl("summoner-picker"));

    // Rooms: play with friends
    this.lobby = new LobbyScreen({
      create: (name) => this.connectToRoom({ create: true, name }),
      join: (code, name) => this.connectToRoom({ code, name }),
      back: () => this.showScreen("champion-select"),
      leave: () => this.leaveRoom(),
      changeChampion: () => this.showScreen("champion-select"),
      switchSide: () => this.connection.sendLobby({ action: "switch_side" }),
      settings: (changes) => this.connection.sendLobby({ action: "settings", ...changes }),
      start: () => this.connection.sendLobby({ action: "start" }),
    }, () => this.connection.getPlayerId());

    // Warn if critical elements missing
    if (!this.overlay) {
      console.warn(
        "[MatchmakingUI] Matchmaking overlay element not found in DOM",
      );
      return;
    }

    // The animated title screen, behind the menu it starts on
    this.titleScreen = new TitleScreen(this.overlay);
    this.titleScreen.setActive(this.isVisible() && TITLE_SCREENS.has(this.currentScreen));

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
   * Start a practice match against bots with the selected champion: 1v1 in
   * mid, or 3v3 / 5v5 with bots in every other role (the server picks theirs).
   */
  private startPractice(): void {
    if (!this.championSelect.getSelectedChampionId()) return;

    // The 1v1 bot plays a random enabled champion
    const botChampionId =
      ENABLED_CHAMPIONS[
        Math.floor(Math.random() * ENABLED_CHAMPIONS.length)
      ];
    this.startMatchmaking("practice", botChampionId);
  }

  /** Cycle the practice match (1v1, 3v3, 5v5, ARAM), remembered across visits */
  private cyclePracticeMode(): void {
    const modes: readonly PracticeMode[] = PRACTICE_MODES;
    this.practiceMode = modes[(modes.indexOf(this.practiceMode) + 1) % modes.length];
    try {
      localStorage.setItem(PRACTICE_MODE_KEY, this.practiceMode.label);
    } catch {
      // Storage unavailable: it lasts until the page reloads
    }
    this.showPracticeMode();
  }

  private showPracticeMode(): void {
    const button = document.getElementById("btn-practice-size");
    if (!button) return;
    button.textContent = this.practiceMode.label;
    button.title = this.practiceMode.title;
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

    // Practice button - start a match against bots, as many as the size chip says
    document.getElementById("btn-practice")?.addEventListener("click", () => {
      this.startPractice();
    });
    // Rooms: from champion select to the room screen (back to the room, if in one)
    document.getElementById("btn-room")?.addEventListener("click", () => this.openRoomScreen());

    document.getElementById("btn-practice-size")?.addEventListener("click", () => {
      this.cyclePracticeMode();
    });
    this.showPracticeMode();

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

    // How to play: the controls
    document
      .getElementById("btn-how-to-play")
      ?.addEventListener("click", () => {
        this.showScreen("how-to-play");
      });
    document
      .getElementById("btn-how-to-play-back")
      ?.addEventListener("click", () => {
        this.showScreen("menu");
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
    this.titleScreen?.setActive(this.isVisible() && TITLE_SCREENS.has(screenId));
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
      getSummonerSpells: () => this.summonerPicker.getSpells(),
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
    }, mode === "practice" ? { size: this.practiceMode.size, map: this.practiceMode.map } : undefined);
  }

  /**
   * The room screen: the room the player is in (telling it their champion,
   * which may have just changed), or the entry view to make or join one.
   */
  private openRoomScreen(): void {
    if (this.lobby.inRoom()) {
      this.connection.sendLobby({
        action: "update",
        championId: this.championSelect.getSelectedChampionId(),
        summonerSpells: this.summonerPicker.getSpells(),
      });
    } else {
      this.lobby.showEntry();
    }
    this.showScreen("lobby");
  }

  /** Connect to make or join a room; its state comes in LOBBY_STATE */
  private connectToRoom(lobby: { create?: boolean; code?: string; name: string }): void {
    if (!this.championSelect.getSelectedChampionId()) return;
    this.connection.disconnect();
    this.updateConnectionStatus("connecting");
    this.connection.connect("lobby", undefined, {
      getChampionId: () => this.championSelect.getSelectedChampionId(),
      getSummonerSpells: () => this.summonerPicker.getSpells(),
      onStatusChange: (status) => this.updateConnectionStatus(status),
      onQueueEntered: () => {},
      onDisconnect: () => {
        if (this.currentScreen === "lobby") this.lobby.showEntry("Connection lost.");
      },
      onLatencyUpdate: (latency) => this.updatePing(latency),
      // A failed join comes back as an error: shown on the room screen
      onError: (error) => this.lobby.showEntry(error),
      onGameStart: (data) => this.handleMatchFound(data),
      onQueueJoined: () => {},
      onLobbyState: (state) => {
        this.lobby.showState(state);
        this.updateRoomButton();
      },
    }, undefined, lobby);
  }

  /** Leave the room and go back to making or joining one */
  private leaveRoom(): void {
    this.connection.sendLobby({ action: "leave" });
    this.connection.disconnect();
    this.updateConnectionStatus("offline");
    this.lobby.showEntry();
    this.updateRoomButton();
  }

  /** Champion select's room button: back to the room while in one */
  private updateRoomButton(): void {
    const button = document.getElementById("btn-room");
    if (button) button.textContent = this.lobby.inRoom() ? "BACK TO ROOM" : "ROOM";
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
    // The match's map becomes the active one before anything draws it
    useMap(isMapId(data?.mapId) ? data.mapId : "wildcrown");

    // Update team displays
    this.matchFound.showTeams(data);

    // Show match found screen
    this.showScreen("match-found");

    // Preload the match's art; the game starts once it's loaded
    this.matchFound.startLoading(() => this.startGame());
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
    this.titleScreen?.setActive(false);
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
