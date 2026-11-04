/**
 * MatchmakingUI - Controls the matchmaking overlay screens.
 *
 * Manages:
 * - Main menu
 * - How to play (practice, a room with friends, the online queue)
 * - Champion select (with the room around it, in a room)
 * - Connecting to server
 * - Queue status
 * - Match found display
 * - Loading progress
 * - Error handling
 *
 * The flow: the menu's PLAY opens the mode screen (practice, a room with
 * friends or the online queue), then champion select for that mode. In a
 * room, champion select shows the room around the champions, and picks go
 * to the room as they're made.
 *
 * MatchmakingUI is the coordinator: it switches screens, wires the buttons,
 * shows the connection status, ping and errors, and starts the game when
 * loading ends. The screens and the network wiring live next to it:
 * - modeSelect.ts: the mode screen (practice matches, rooms, the queue)
 * - championSelect.ts: champion grid, detail panel and the selected champion
 * - roomPanel.ts: the room on champion select (code, settings, both sides)
 * - abilityCards.ts, abilityText.ts: ability and passive cards; their
 *   tooltip text and scaling previews
 * - queueScreen.ts: queue timer, position and size
 * - matchFound.ts, matchAssets.ts: the loading screen (a card per player)
 *   and the art it preloads for the match
 * - matchConnection.ts: NetworkClient setup, player ID and session token,
 *   and the full state and updates buffered for OnlineGame
 * - tips.ts: rotating gameplay tips
 * - account.ts, accountScreen.ts: signing in, the menu's account line
 * - profileScreen.ts, profileFormat.ts: an account's profile and its matches
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
import { MAPS, isMapId, useMap, type LobbyState } from "@siege/shared";
import { ChampionSelect, ENABLED_CHAMPIONS } from "./championSelect";
import { MatchConnection } from "./matchConnection";
import { MatchFoundScreen } from "./matchFound";
import { QueueScreen } from "./queueScreen";
import { SummonerPicker } from "./summonerPicker";
import { startTipRotation, showRandomTip } from "./tips";
import { TitleScreen } from "../title/TitleScreen";
import { ModeSelect, describePracticeMode, type PracticeMode } from "./modeSelect";
import { RoomPanel, type Room } from "./roomPanel";
import { fillHowToPlay } from "./howToPlay";
import { AccountClient, apiBaseUrl } from "./account";
import { AccountScreen } from "./accountScreen";
import { ProfileScreen } from "./profileScreen";
import { ControlsPanel } from "@/ui/ControlsPanel";

/** The screens the title screen's valley shows behind (not champion select or the loading screen) */
const TITLE_SCREENS: ReadonlySet<ScreenId> = new Set(["menu", "modes", "how-to-play", "settings", "account", "profile", "connecting", "queue", "error"]);

/** What champion select is for: the mode picked on the mode screen */
type SelectFor =
  | { kind: "practice"; mode: PracticeMode }
  | { kind: "queue" }
  | { kind: "room" };

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

  /** What champion select is for */
  private selectFor: SelectFor = { kind: "queue" };

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
  private modes: ModeSelect;
  private room: RoomPanel;

  // Network client and the state buffered for OnlineGame
  private connection: MatchConnection;
  /** The player's account, if they signed in */
  private readonly accounts: AccountClient;

  // State
  private currentScreen: ScreenId = "menu";
  private matchData: MatchData | null = null;

  // Callbacks
  private callbacks: MatchmakingUICallbacks;

  constructor(
    serverUrl: string = "ws://localhost:8080/ws",
    callbacks: MatchmakingUICallbacks = {},
  ) {
    // The player's account (optional): its token goes with READY
    this.accounts = new AccountClient(apiBaseUrl(serverUrl), browserStorage());
    this.connection = new MatchConnection(serverUrl, () => this.accounts.current()?.token);
    this.callbacks = callbacks;

    // Get DOM elements - use safe getter that won't crash if element missing
    const getEl = (id: string) => document.getElementById(id) as HTMLElement;

    this.overlay = getEl("matchmaking-overlay");

    // Get screens
    this.screens.set("menu", getEl("screen-menu"));
    this.screens.set("modes", getEl("screen-modes"));
    this.screens.set("champion-select", getEl("screen-champion-select"));
    this.screens.set("connecting", getEl("screen-connecting"));
    this.screens.set("queue", getEl("screen-queue"));
    this.screens.set("match-found", getEl("screen-match-found"));
    this.screens.set("how-to-play", getEl("screen-how-to-play"));
    this.screens.set("settings", getEl("screen-settings"));
    this.screens.set("account", getEl("screen-account"));
    this.screens.set("profile", getEl("screen-profile"));
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

    // How to play: picked before the champion
    this.modes = new ModeSelect({
      practice: (mode) => this.openChampionSelect({ kind: "practice", mode }),
      createRoom: (name) => this.connectToRoom({ create: true, name }),
      joinRoom: (code, name) => this.connectToRoom({ code, name }),
      online: () => this.openChampionSelect({ kind: "queue" }),
      back: () => this.showScreen("menu"),
    });

    // Signing in (the main menu's line, its screen); signed in, rooms show the account's name.
    // Its line opens the account's profile (rating, matches)
    const profile = new ProfileScreen(this.accounts, (screen) => this.showScreen(screen));
    new AccountScreen(this.accounts, (screen) => this.showScreen(screen), (name) => profile.open(name));
    this.accounts.subscribe(current => this.modes.setAccountName(current?.account.name ?? null));
    this.modes.setAccountName(this.accounts.current()?.account.name ?? null);

    // Rooms: play with friends, shown on champion select
    this.room = new RoomPanel(
      (changes) => this.connection.sendLobby({ action: "settings", ...changes }),
      () => this.connection.getPlayerId(),
    );
    // In a room, picks go to the room as they're made
    const sendPicks = () => {
      if (this.selectFor.kind !== "room") return;
      this.connection.sendLobby({
        action: "update",
        championId: this.championSelect.getSelectedChampionId(),
        summonerSpells: this.summonerPicker.getSpells(),
      });
    };
    this.championSelect.onPick = sendPicks;
    this.summonerPicker.onChange = sendPicks;

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
   * Champion select for a mode: its context line and buttons, and the room
   * around the champions when it's for a room.
   */
  private openChampionSelect(selectFor: SelectFor): void {
    this.selectFor = selectFor;
    this.showChampionSelectMode();
    this.showScreen("champion-select");
  }

  /** Champion select's context line and buttons for what it's for */
  private showChampionSelectMode(): void {
    const context = document.getElementById("champion-select-context");
    const back = document.getElementById("btn-back-menu");
    const go = document.getElementById("btn-lock-in");
    const switchSide = document.getElementById("btn-switch-side");
    const inRoom = this.selectFor.kind === "room";

    if (context) {
      context.hidden = inRoom;
      context.textContent = this.selectFor.kind === "practice"
        ? describePracticeMode(this.selectFor.mode)
        : `ONLINE 1V1 · ${MAPS.vale.NAME.toUpperCase()}`;
    }
    if (back) back.textContent = inRoom ? "LEAVE" : "BACK";
    if (switchSide) switchSide.hidden = !inRoom;
    if (go) {
      go.textContent = this.selectFor.kind === "queue" ? "FIND MATCH" : "START";
      // In a room only the host starts
      go.hidden = inRoom && !this.room.isHost();
    }
  }

  /** Champion select's main button: start practice, queue, or start the room's match */
  private go(): void {
    switch (this.selectFor.kind) {
      case "practice": {
        // The 1v1 bot plays a random enabled champion
        const botChampionId = ENABLED_CHAMPIONS[Math.floor(Math.random() * ENABLED_CHAMPIONS.length)];
        this.startMatchmaking("practice", botChampionId);
        break;
      }
      case "queue":
        this.startMatchmaking("queue");
        break;
      case "room":
        this.connection.sendLobby({ action: "start" });
        break;
    }
  }

  /**
   * Setup button event listeners.
   */
  private setupEventListeners(): void {
    // Play button - pick how to play
    document.getElementById("btn-play")?.addEventListener("click", () => {
      this.showScreen("modes");
    });

    // Back to the modes (leaving the room, in one)
    document.getElementById("btn-back-menu")?.addEventListener("click", () => {
      if (this.selectFor.kind === "room") this.leaveRoom();
      else this.showScreen("modes");
    });

    // Start, find a match, or (the room's host) start the room's match
    document.getElementById("btn-lock-in")?.addEventListener("click", () => this.go());
    document.getElementById("btn-switch-side")?.addEventListener("click", () => {
      this.connection.sendLobby({ action: "switch_side" });
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

    // Settings: the controls (cast mode, keys)
    const settings = new ControlsPanel(() => this.showScreen("menu"));
    this.screens.get("settings")?.append(settings.element);
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      this.showScreen("settings");
    });

    // How to play: the controls, with the player's keys
    document
      .getElementById("btn-how-to-play")
      ?.addEventListener("click", () => {
        const grid = document.getElementById("how-to-play-controls");
        if (grid) fillHowToPlay(grid);
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
      container.classList.toggle("profile-mode", screenId === "profile");
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
    }, this.selectFor.kind === "practice" ? { size: this.selectFor.mode.size, map: this.selectFor.mode.map } : undefined);
  }

  /**
   * Connect to make or join a room, with the champion picked last time
   * (changed in the room). Champion select opens on the room's first
   * LOBBY_STATE; a failed join shows its error on the mode screen.
   */
  private connectToRoom(lobby: { create?: boolean; code?: string; name: string }): void {
    this.connection.disconnect();
    this.modes.setConnecting(true);
    this.updateConnectionStatus("connecting");
    this.connection.connect("lobby", undefined, {
      getChampionId: () => this.championSelect.getSelectedChampionId(),
      getSummonerSpells: () => this.summonerPicker.getSpells(),
      onStatusChange: (status) => this.updateConnectionStatus(status),
      onQueueEntered: () => {},
      onDisconnect: () => {
        if (this.currentScreen === "modes" || this.currentScreen === "champion-select") {
          this.closeRoom(this.room.getRoom() ? "Connection lost." : "Couldn't reach the server.");
        }
      },
      onLatencyUpdate: (latency) => this.updatePing(latency),
      onError: (error) => this.closeRoom(error),
      onGameStart: (data) => this.handleMatchFound(data),
      onQueueJoined: () => {},
      onLobbyState: (state) => this.showRoom(state),
    }, undefined, lobby);
  }

  /** The room's state from the server: champion select shows it */
  private showRoom(state: LobbyState): void {
    if (state.code === null) {
      this.closeRoom(state.reason);
      return;
    }
    const room: Room = state;
    const opening = this.room.getRoom() === null;
    this.room.show(room);
    this.championSelect.setTaken(this.room.takenByTeammates());
    // The server has the player's champion (it keeps them off a teammate's)
    const me = this.room.me();
    if (me && me.championId !== this.championSelect.getSelectedChampionId()) {
      this.championSelect.select(me.championId);
    }
    if (opening) {
      this.modes.setConnecting(false);
      this.openChampionSelect({ kind: "room" });
    } else {
      // The host may have changed
      this.showChampionSelectMode();
    }
  }

  /** Out of the room (or never in it): back to the mode screen, with why */
  private closeRoom(error?: string): void {
    this.room.show(null);
    this.championSelect.setTaken(new Map());
    this.connection.disconnect();
    this.updateConnectionStatus("offline");
    if (error) this.modes.showError(error);
    else this.modes.setConnecting(false);
    if (this.currentScreen === "champion-select" && this.selectFor.kind === "room") this.showScreen("modes");
  }

  /** Leave the room and go back to the modes */
  private leaveRoom(): void {
    this.connection.sendLobby({ action: "leave" });
    this.closeRoom();
    this.showScreen("modes");
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
    // A room becomes the match
    this.room.show(null);
    this.championSelect.setTaken(new Map());
    // The match's map becomes the active one before anything draws it
    useMap(isMapId(data?.mapId) ? data.mapId : "vale");

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
   * Show error screen (also from a match: why it was left).
   */
  showError(message: string): void {
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
    // Back from a match: the account's wins and losses may have changed
    void this.accounts.refresh();
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

/** The browser's localStorage, if it's allowed */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
