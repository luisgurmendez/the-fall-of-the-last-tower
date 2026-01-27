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
  getAllChampionDefinitions,
  getAbilityDefinition,
  getPassiveDefinition,
  ABILITY_DEFINITIONS,
  type ChampionDefinition,
  type AbilityDefinition,
  type PassiveAbilityDefinition,
  type AbilityScaling,
} from "@siege/shared";

// Debug: verify imports
console.log("[MatchmakingUI] Module loaded");
console.log("[MatchmakingUI] getAbilityDefinition:", typeof getAbilityDefinition);
console.log("[MatchmakingUI] ABILITY_DEFINITIONS:", ABILITY_DEFINITIONS);
console.log("[MatchmakingUI] Test lookup warrior_slash:", getAbilityDefinition("warrior_slash"));

/**
 * Screen identifiers.
 */
export type ScreenId =
  | "menu"
  | "champion-select"
  | "connecting"
  | "queue"
  | "match-found"
  | "error";

/**
 * Connection status.
 */
export type ConnectionStatus = "offline" | "connecting" | "online";

/**
 * Match data received from server.
 */
export interface MatchData {
  gameId: string;
  yourSide: number;
  players: Array<{
    playerId: string;
    championId: string;
    side: number;
    entityId: string;
  }>;
}

/**
 * Callbacks for game events.
 */
export interface MatchmakingUICallbacks {
  onGameStart?: (matchData: MatchData) => void;
  onGameReady?: () => void;
}

/**
 * Tips to display randomly.
 */
const TIPS = [
  "Tip: Use QWER for abilities, right-click to move",
  "Tip: Press P to open the shop",
  "Tip: Last hitting minions gives bonus gold",
  "Tip: Stay behind your minions to avoid tower damage",
  "Tip: Press TAB to see the scoreboard",
  "Tip: Wards reveal invisible enemies",
  "Tip: Killing dragon gives team-wide buffs",
];

/**
 * Champion icons (emoji placeholders).
 */
const CHAMPION_ICONS: Record<string, string> = {
  warrior: "⚔️",
  magnus: "🔮",
  elara: "✨",
  vex: "🗡️",
  gorath: "🛡️",
};

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

  // Queue elements
  private queueTimer: HTMLElement;
  private queuePosition: HTMLElement;
  private queueSize: HTMLElement;

  // Match found elements
  private blueChampion: HTMLElement;
  private redChampion: HTMLElement;
  private loadingBar: HTMLElement;

  // Error elements
  private errorMessage: HTMLElement;

  // Champion select elements
  private championGrid: HTMLElement;
  private detailPortrait: HTMLElement;
  private detailName: HTMLElement;
  private detailTitle: HTMLElement;
  private detailClass: HTMLElement;
  private detailStats: HTMLElement;
  private detailPassive: HTMLElement;
  private detailAbilities: HTMLElement;
  private lockInButton: HTMLButtonElement;

  // Network
  private networkClient: NetworkClient | null = null;
  private serverUrl: string;
  private playerId: string;

  // State
  private currentScreen: ScreenId = "menu";
  private queueStartTime: number = 0;
  private queueTimerInterval: ReturnType<typeof setInterval> | null = null;
  private loadingProgress: number = 0;
  private matchData: MatchData | null = null;
  private selectedChampionId: string = "warrior";
  private bufferedFullState: any = null;

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
    this.queueTimer = getEl("queue-timer");
    this.queuePosition = getEl("queue-position");
    this.queueSize = getEl("queue-size");

    // Get match found elements
    this.blueChampion = getEl("blue-champion");
    this.redChampion = getEl("red-champion");
    this.loadingBar = getEl("loading-bar");

    // Get error elements
    this.errorMessage = getEl("error-message");

    // Get champion select elements
    this.championGrid = getEl("champion-grid");
    this.detailPortrait = getEl("detail-portrait");
    this.detailName = getEl("detail-name");
    this.detailTitle = getEl("detail-title");
    this.detailClass = getEl("detail-class");
    this.detailStats = getEl("detail-stats");
    this.detailPassive = getEl("detail-passive");
    this.detailAbilities = getEl("detail-abilities");
    this.lockInButton = getEl("btn-lock-in") as HTMLButtonElement;

    // Debug: Check if abilities element was found
    console.log("[MatchmakingUI] Constructor - detailAbilities element:", this.detailAbilities);
    if (!this.detailAbilities) {
      console.error("[MatchmakingUI] CRITICAL: detail-abilities element not found in DOM!");
      console.log("[MatchmakingUI] Looking for element with id 'detail-abilities'...");
      console.log("[MatchmakingUI] All elements with 'detail' in id:",
        Array.from(document.querySelectorAll('[id*="detail"]')).map(el => el.id));
    }

    // Warn if critical elements missing
    if (!this.overlay) {
      console.warn(
        "[MatchmakingUI] Matchmaking overlay element not found in DOM",
      );
      return;
    }

    // Setup champion select
    this.setupChampionSelect();

    // Setup event listeners
    this.setupEventListeners();

    // Start tip rotation
    this.startTipRotation();

    // Show random tip
    this.showRandomTip();
  }

  /**
   * Generate a unique player ID.
   */
  private generatePlayerId(): string {
    const stored = localStorage.getItem("siege-player-id");
    if (stored) return stored;

    const id = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("siege-player-id", id);
    return id;
  }

  /**
   * Setup the champion select screen.
   */
  private setupChampionSelect(): void {
    this.populateChampionGrid();
  }

  /**
   * Populate the champion grid with all available champions.
   */
  private populateChampionGrid(): void {
    if (!this.championGrid) return;

    this.championGrid.innerHTML = "";
    const champions = getAllChampionDefinitions();

    for (const champion of champions) {
      const card = this.createChampionCard(champion);
      this.championGrid.appendChild(card);
    }

    // Select first champion by default
    if (champions.length > 0) {
      this.selectChampion(champions[0].id);
    }
  }

  /**
   * Create a champion card element.
   */
  private createChampionCard(champion: ChampionDefinition): HTMLElement {
    const card = document.createElement("div");
    card.className = "champion-card";
    card.dataset.championId = champion.id;
    card.dataset.class = champion.class;

    const portrait = document.createElement("div");
    portrait.className = "champion-portrait";
    portrait.textContent = CHAMPION_ICONS[champion.id] || "❓";

    const name = document.createElement("div");
    name.className = "champion-card-name";
    name.textContent = champion.name;

    const championClass = document.createElement("div");
    championClass.className = "champion-card-class";
    championClass.textContent = champion.class;

    card.appendChild(portrait);
    card.appendChild(name);
    card.appendChild(championClass);

    // Click handler
    card.addEventListener("click", () => {
      this.selectChampion(champion.id);
    });

    return card;
  }

  /**
   * Select a champion.
   */
  private selectChampion(championId: string): void {
    this.selectedChampionId = championId;

    // Update card selection state
    const cards = this.championGrid?.querySelectorAll(".champion-card");
    cards?.forEach((card) => {
      const el = card as HTMLElement;
      if (el.dataset.championId === championId) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    });

    // Update details panel
    this.updateChampionDetails(championId);

    // Enable lock-in button
    if (this.lockInButton) {
      this.lockInButton.disabled = false;
    }
  }

  /**
   * Update the champion details panel.
   */
  private updateChampionDetails(championId: string): void {
    const champion = CHAMPION_DEFINITIONS[championId];
    if (!champion) return;

    // Update portrait
    if (this.detailPortrait) {
      this.detailPortrait.textContent = CHAMPION_ICONS[championId] || "❓";
    }

    // Update name
    if (this.detailName) {
      this.detailName.textContent = champion.name;
    }

    // Update title
    if (this.detailTitle) {
      this.detailTitle.textContent = champion.title;
    }

    // Update class
    if (this.detailClass) {
      this.detailClass.textContent = champion.class.toUpperCase();
    }

    // Update stats
    const stats = champion.baseStats;
    if (this.detailStats) {
      this.detailStats.innerHTML = `
        <div class="champion-stat-row">
          <span class="champion-stat-label">Health</span>
          <span class="champion-stat-value health">${stats.health}</span>
        </div>
        <div class="champion-stat-row">
          <span class="champion-stat-label">Mana</span>
          <span class="champion-stat-value mana">${stats.resource}</span>
        </div>
        <div class="champion-stat-row">
          <span class="champion-stat-label">Attack</span>
          <span class="champion-stat-value ad">${stats.attackDamage}</span>
        </div>
        <div class="champion-stat-row">
          <span class="champion-stat-label">Armor</span>
          <span class="champion-stat-value armor">${stats.armor}</span>
        </div>
        <div class="champion-stat-row">
          <span class="champion-stat-label">MR</span>
          <span class="champion-stat-value mr">${stats.magicResist}</span>
        </div>
        <div class="champion-stat-row">
          <span class="champion-stat-label">Speed</span>
          <span class="champion-stat-value ms">${stats.movementSpeed}</span>
        </div>
      `;
    }

    // Update passive
    if (this.detailPassive) {
      this.detailPassive.innerHTML = "";
      const passiveId = champion.passive;
      if (passiveId) {
        const passiveDef = getPassiveDefinition(passiveId);
        if (passiveDef) {
          const passiveCard = this.createPassiveCard(passiveDef, championId);
          this.detailPassive.appendChild(passiveCard);
        }
      }
    }

    // Update abilities
    if (this.detailAbilities) {
      this.detailAbilities.innerHTML = "";
      const slots: Array<"Q" | "W" | "E" | "R"> = ["Q", "W", "E", "R"];

      console.log("[MatchmakingUI] Updating abilities for champion:", championId);
      console.log("[MatchmakingUI] champion.abilities:", champion.abilities);

      for (const slot of slots) {
        const abilityId = champion.abilities[slot];
        console.log(`[MatchmakingUI] Slot ${slot}: abilityId = "${abilityId}"`);
        if (!abilityId) {
          console.log(`[MatchmakingUI] Slot ${slot}: No ability ID, skipping`);
          continue;
        }

        const abilityDef = getAbilityDefinition(abilityId);
        console.log(`[MatchmakingUI] Slot ${slot}: abilityDef =`, abilityDef);
        if (!abilityDef) {
          console.log(`[MatchmakingUI] Slot ${slot}: No ability definition found for "${abilityId}"`);
          continue;
        }

        const abilityCard = this.createAbilityCard(slot, abilityDef, stats, championId);
        this.detailAbilities.appendChild(abilityCard);
        console.log(`[MatchmakingUI] Slot ${slot}: Added ability card`);
      }
    } else {
      console.log("[MatchmakingUI] detailAbilities element not found!");
    }
  }

  /**
   * Create an ability card element for the champion select screen.
   */
  private createAbilityCard(
    slot: string,
    ability: AbilityDefinition,
    baseStats: ChampionDefinition["baseStats"],
    championId: string,
  ): HTMLElement {
    const card = document.createElement("div");
    card.className = "ability-card";

    // Ability header with icon, slot and name
    const header = document.createElement("div");
    header.className = "ability-card-header";

    // Add ability icon
    const iconSlot = slot.toLowerCase();
    const iconPath = `/src/assets/abilities/${championId}/${iconSlot}.png`;
    const icon = document.createElement("img");
    icon.className = "ability-icon";
    icon.src = iconPath;
    icon.alt = `${slot} ability`;
    icon.width = 48;
    icon.height = 48;
    // Hide if image fails to load
    icon.onerror = () => { icon.style.display = 'none'; };
    header.appendChild(icon);

    const headerText = document.createElement("div");
    headerText.className = "ability-card-header-text";
    headerText.innerHTML = `
      <span class="ability-slot">${slot}</span>
      <span class="ability-name">${ability.name}</span>
    `;
    header.appendChild(headerText);
    card.appendChild(header);

    // Description with interpolated values at rank 1
    const description = document.createElement("div");
    description.className = "ability-description";
    const interpolatedDesc = this.interpolateAbilityDescription(
      ability,
      1,
      baseStats,
    );
    description.innerHTML = interpolatedDesc;
    card.appendChild(description);

    // Stats row (cooldown, cost, range)
    const statsRow = document.createElement("div");
    statsRow.className = "ability-stats-row";

    const statParts: string[] = [];
    if (ability.cooldown && ability.cooldown.length > 0) {
      const cdValues = ability.cooldown.map((cd) => cd.toString()).join("/");
      statParts.push(`CD: ${cdValues}s`);
    }
    if (ability.manaCost && ability.manaCost.length > 0) {
      const costValues = ability.manaCost.map((c) => c.toString()).join("/");
      statParts.push(`Cost: ${costValues}`);
    }
    if (ability.range && ability.range > 0) {
      statParts.push(`Range: ${ability.range}`);
    }

    statsRow.textContent = statParts.join("  •  ");
    card.appendChild(statsRow);

    // Scaling info
    const scalingInfo = this.getAbilityScalingInfo(ability);
    if (scalingInfo) {
      const scaling = document.createElement("div");
      scaling.className = "ability-scaling";
      scaling.innerHTML = scalingInfo;
      card.appendChild(scaling);
    }

    return card;
  }

  /**
   * Create a passive card element for the champion select screen.
   */
  private createPassiveCard(passive: PassiveAbilityDefinition, championId: string): HTMLElement {
    const card = document.createElement("div");
    card.className = "passive-card";

    // Passive header with icon, slot (P) and name
    const header = document.createElement("div");
    header.className = "passive-card-header";

    // Add passive icon
    const iconPath = `/src/assets/abilities/${championId}/passive.png`;
    const icon = document.createElement("img");
    icon.className = "passive-icon";
    icon.src = iconPath;
    icon.alt = "Passive ability";
    icon.width = 48;
    icon.height = 48;
    // Hide if image fails to load
    icon.onerror = () => { icon.style.display = 'none'; };
    header.appendChild(icon);

    const headerText = document.createElement("div");
    headerText.className = "passive-card-header-text";
    headerText.innerHTML = `
      <span class="passive-slot">P</span>
      <span class="passive-name">${passive.name}</span>
    `;
    header.appendChild(headerText);
    card.appendChild(header);

    // Trigger type
    const trigger = document.createElement("div");
    trigger.className = "passive-trigger";
    trigger.textContent = `Trigger: ${this.formatPassiveTrigger(passive.trigger)}`;
    card.appendChild(trigger);

    // Description
    const description = document.createElement("div");
    description.className = "passive-description";
    description.textContent = passive.description;
    card.appendChild(description);

    // Stats row (cooldown, stacks)
    const statsRow = document.createElement("div");
    statsRow.className = "passive-stats-row";

    const statParts: string[] = [];
    if (passive.internalCooldown) {
      statParts.push(`Cooldown: ${passive.internalCooldown}s`);
    }
    if (passive.maxStacks) {
      statParts.push(`Max Stacks: ${passive.maxStacks}`);
    }
    if (passive.healthThreshold) {
      statParts.push(`Threshold: ${Math.round(passive.healthThreshold * 100)}% HP`);
    }

    statsRow.textContent = statParts.join("  •  ");
    if (statParts.length > 0) {
      card.appendChild(statsRow);
    }

    return card;
  }

  /**
   * Format passive trigger type for display.
   */
  private formatPassiveTrigger(trigger: string): string {
    const triggerLabels: Record<string, string> = {
      'on_attack': 'On Attack',
      'on_hit': 'On Hit',
      'on_take_damage': 'On Taking Damage',
      'on_ability_cast': 'On Ability Cast',
      'on_ability_hit': 'On Ability Hit',
      'on_kill': 'On Kill',
      'on_low_health': 'Low Health',
      'always': 'Always Active',
      'on_interval': 'Periodic',
    };
    return triggerLabels[trigger] || trigger;
  }

  /**
   * Interpolate ability description with calculated values.
   */
  private interpolateAbilityDescription(
    ability: AbilityDefinition,
    rank: number,
    baseStats: ChampionDefinition["baseStats"],
  ): string {
    let description = ability.description;

    const stats = {
      attackDamage: baseStats.attackDamage,
      abilityPower: baseStats.abilityPower,
      bonusHealth: 0,
      maxHealth: baseStats.health,
      armor: baseStats.armor,
      magicResist: baseStats.magicResist,
    };

    // Replace {damage}
    if (ability.damage?.scaling) {
      const value = this.calculateScalingValue(
        ability.damage.scaling,
        rank,
        stats,
      );
      const formatted = this.formatScalingPreview(
        value,
        ability.damage.scaling,
      );
      description = description.replace("{damage}", formatted);
    }

    // Replace {heal}
    if (ability.heal?.scaling) {
      const value = this.calculateScalingValue(
        ability.heal.scaling,
        rank,
        stats,
      );
      const formatted = this.formatScalingPreview(value, ability.heal.scaling);
      description = description.replace("{heal}", formatted);
    }

    // Replace {shield}
    if (ability.shield?.scaling) {
      const value = this.calculateScalingValue(
        ability.shield.scaling,
        rank,
        stats,
      );
      const formatted = this.formatScalingPreview(
        value,
        ability.shield.scaling,
      );
      description = description.replace("{shield}", formatted);
    }

    return description;
  }

  /**
   * Calculate a scaling value at a given rank.
   */
  private calculateScalingValue(
    scaling: AbilityScaling,
    rank: number,
    stats: {
      attackDamage?: number;
      abilityPower?: number;
      bonusHealth?: number;
      maxHealth?: number;
      armor?: number;
      magicResist?: number;
    },
  ): number {
    if (rank < 1 || rank > scaling.base.length) return 0;

    let value = scaling.base[rank - 1];

    if (scaling.adRatio && stats.attackDamage) {
      value += stats.attackDamage * scaling.adRatio;
    }
    if (scaling.apRatio && stats.abilityPower) {
      value += stats.abilityPower * scaling.apRatio;
    }
    if (scaling.bonusHealthRatio && stats.bonusHealth) {
      value += stats.bonusHealth * scaling.bonusHealthRatio;
    }
    if (scaling.maxHealthRatio && stats.maxHealth) {
      value += stats.maxHealth * scaling.maxHealthRatio;
    }
    if (scaling.armorRatio && stats.armor) {
      value += stats.armor * scaling.armorRatio;
    }
    if (scaling.magicResistRatio && stats.magicResist) {
      value += stats.magicResist * scaling.magicResistRatio;
    }

    return value;
  }

  /**
   * Format scaling preview with base values and ratios.
   */
  private formatScalingPreview(value: number, scaling: AbilityScaling): string {
    const baseValues = scaling.base.join("/");
    const scalingParts: string[] = [];

    if (scaling.adRatio) {
      scalingParts.push(
        `<span class="scaling-ad">+${Math.round(scaling.adRatio * 100)}% AD</span>`,
      );
    }
    if (scaling.apRatio) {
      scalingParts.push(
        `<span class="scaling-ap">+${Math.round(scaling.apRatio * 100)}% AP</span>`,
      );
    }
    if (scaling.bonusHealthRatio) {
      scalingParts.push(
        `<span class="scaling-hp">+${Math.round(scaling.bonusHealthRatio * 100)}% Bonus HP</span>`,
      );
    }
    if (scaling.maxHealthRatio) {
      scalingParts.push(
        `<span class="scaling-hp">+${Math.round(scaling.maxHealthRatio * 100)}% Max HP</span>`,
      );
    }
    if (scaling.armorRatio) {
      scalingParts.push(
        `<span class="scaling-armor">+${Math.round(scaling.armorRatio * 100)}% Armor</span>`,
      );
    }
    if (scaling.magicResistRatio) {
      scalingParts.push(
        `<span class="scaling-mr">+${Math.round(scaling.magicResistRatio * 100)}% MR</span>`,
      );
    }

    if (scalingParts.length > 0) {
      return `${baseValues} (${scalingParts.join(" ")})`;
    }

    return baseValues;
  }

  /**
   * Get scaling info HTML for an ability.
   */
  private getAbilityScalingInfo(ability: AbilityDefinition): string | null {
    const parts: string[] = [];

    if (ability.damage?.scaling) {
      const dmgType =
        ability.damage.type === "physical"
          ? "Physical"
          : ability.damage.type === "magic"
            ? "Magic"
            : "True";
      parts.push(
        `<span class="scaling-label">${dmgType} Damage:</span> ${this.formatScalingPreview(0, ability.damage.scaling)}`,
      );
    }

    if (ability.heal?.scaling) {
      parts.push(
        `<span class="scaling-label">Heal:</span> ${this.formatScalingPreview(0, ability.heal.scaling)}`,
      );
    }

    if (ability.shield?.scaling) {
      const duration = ability.shield.duration
        ? ` (${ability.shield.duration}s)`
        : "";
      parts.push(
        `<span class="scaling-label">Shield${duration}:</span> ${this.formatScalingPreview(0, ability.shield.scaling)}`,
      );
    }

    return parts.length > 0 ? parts.join("<br>") : null;
  }

  /**
   * Lock in the selected champion and proceed to matchmaking.
   */
  private lockInChampion(): void {
    if (!this.selectedChampionId) return;

    // Start matchmaking with selected champion
    this.startMatchmaking();
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
    for (const [id, element] of this.screens) {
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
  private startMatchmaking(): void {
    this.showScreen("connecting");
    this.updateConnectionStatus("connecting");

    // Create network client
    this.networkClient = new NetworkClient({
      serverUrl: this.serverUrl,
      playerId: this.playerId,
      gameId: "", // Will be assigned by server
    });

    // Setup event handlers
    this.networkClient.onConnect = () => {
      console.log("[MatchmakingUI] Connected to server");
      this.updateConnectionStatus("online");

      // Send ready message to join queue with selected champion
      console.log(
        `[MatchmakingUI] Sending ready with selectedChampionId="${this.selectedChampionId}"`,
      );
      this.networkClient?.sendReady(this.selectedChampionId);
      this.showScreen("queue");
      this.startQueueTimer();
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
    };

    this.networkClient.onStateUpdate = (update: any) => {
      // Handle state updates during game
      // This will be passed to the game once it starts
    };

    // Handle custom events (queue joined, etc.)
    const originalOnMessage = (this.networkClient as any).handleMessage?.bind(
      this.networkClient,
    );
    (this.networkClient as any).handleServerMessage = (message: any) => {
      if (message.type === 2 && message.data?.event === "queue_joined") {
        this.updateQueueInfo(message.data.position, message.data.queueSize);
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
    this.stopQueueTimer();
    this.networkClient?.disconnect();
    this.networkClient = null;
    this.updateConnectionStatus("offline");
    this.showScreen("champion-select");
  }

  /**
   * Start the queue timer.
   */
  private startQueueTimer(): void {
    this.queueStartTime = Date.now();
    this.queueTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      if (this.queueTimer) {
        this.queueTimer.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }
    }, 1000);
  }

  /**
   * Stop the queue timer.
   */
  private stopQueueTimer(): void {
    if (this.queueTimerInterval) {
      clearInterval(this.queueTimerInterval);
      this.queueTimerInterval = null;
    }
  }

  /**
   * Update queue info display.
   */
  private updateQueueInfo(position: number, size: number): void {
    if (this.queuePosition)
      this.queuePosition.textContent = position.toString();
    if (this.queueSize) this.queueSize.textContent = size.toString();
  }

  /**
   * Handle match found from server.
   */
  private handleMatchFound(data: any): void {
    this.stopQueueTimer();
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
    this.stopQueueTimer();
  }

  /**
   * Start tip rotation.
   */
  private startTipRotation(): void {
    setInterval(() => {
      this.showRandomTip();
    }, 10000);
  }

  /**
   * Show a random tip.
   */
  private showRandomTip(): void {
    if (!this.tipText) return;
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.tipText.textContent = tip;
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
    return this.selectedChampionId;
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
   * Reset to initial state.
   */
  reset(): void {
    this.stopQueueTimer();
    this.networkClient?.disconnect();
    this.networkClient = null;
    this.matchData = null;
    this.loadingProgress = 0;
    this.bufferedFullState = null;
    this.updateConnectionStatus("offline");
    this.showScreen("menu");
  }
}
