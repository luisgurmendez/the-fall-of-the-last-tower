/**
 * Champion select screen: the grid of champion cards and the detail panel
 * (portrait, stats, passive and ability cards) for the selected champion.
 */

import {
  CHAMPION_DEFINITIONS,
  getAllChampionDefinitions,
  getAbilityDefinition,
  getPassiveDefinition,
  type ChampionDefinition,
} from "@siege/shared";
import { createAbilityCard, createPassiveCard } from "./abilityCards";

/**
 * Champion icons (emoji placeholders).
 */
export const CHAMPION_ICONS: Record<string, string> = {
  warrior: "⚔️",
  magnus: "🔮",
  elara: "✨",
  vex: "🗡️",
  gorath: "🛡️",
  vile: "💀",
  lume: "☀️",
};

/**
 * Champions available for selection.
 * Filter to only show finished/polished champions.
 */
export const ENABLED_CHAMPIONS = ['vex', 'lume', 'vile'];

/**
 * Champion select elements and the selected champion, which MatchmakingUI
 * sends to the server when it connects.
 */
export class ChampionSelect {
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
  private practiceButton: HTMLButtonElement;

  // State
  private selectedChampionId: string = "lume";

  constructor(getEl: (id: string) => HTMLElement) {
    this.championGrid = getEl("champion-grid");
    this.detailPortrait = getEl("detail-portrait");
    this.detailName = getEl("detail-name");
    this.detailTitle = getEl("detail-title");
    this.detailClass = getEl("detail-class");
    this.detailStats = getEl("detail-stats");
    this.detailPassive = getEl("detail-passive");
    this.detailAbilities = getEl("detail-abilities");
    this.lockInButton = getEl("btn-lock-in") as HTMLButtonElement;
    this.practiceButton = getEl("btn-practice") as HTMLButtonElement;

    if (!this.detailAbilities) {
      console.error("[MatchmakingUI] detail-abilities element not found in DOM");
    }
  }

  /**
   * Get selected champion ID.
   */
  getSelectedChampionId(): string {
    return this.selectedChampionId;
  }

  /**
   * Setup the champion select screen.
   */
  setup(): void {
    this.populateChampionGrid();
  }

  /**
   * Populate the champion grid with available champions.
   */
  private populateChampionGrid(): void {
    if (!this.championGrid) return;

    this.championGrid.innerHTML = "";
    const allChampions = getAllChampionDefinitions();

    // Filter to only show enabled champions
    const champions = allChampions.filter(c =>
      ENABLED_CHAMPIONS.includes(c.id)
    );

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

    // Enable lock-in and practice buttons
    if (this.practiceButton) {
      this.practiceButton.disabled = false;
    }
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
          <span class="champion-stat-label">${this.formatResourceName(champion.resourceType)}</span>
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
          const passiveCard = createPassiveCard(passiveDef, championId);
          this.detailPassive.appendChild(passiveCard);
        }
      }
    }

    // Update abilities
    if (this.detailAbilities) {
      this.detailAbilities.innerHTML = "";
      const slots: Array<"Q" | "W" | "E" | "R"> = ["Q", "W", "E", "R"];

      for (const slot of slots) {
        const abilityId = champion.abilities[slot];
        if (!abilityId) continue;

        const abilityDef = getAbilityDefinition(abilityId);
        if (!abilityDef) {
          console.warn(`[MatchmakingUI] No ability definition for "${abilityId}" (${championId} ${slot})`);
          continue;
        }

        this.detailAbilities.appendChild(createAbilityCard(slot, abilityDef, stats, championId));
      }
    }
  }

  /**
   * Display name for a champion's resource ("Mana", "Energy", ...).
   */
  private formatResourceName(resourceType: string): string {
    return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  }
}
