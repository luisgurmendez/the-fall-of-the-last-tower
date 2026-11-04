/**
 * Champion select screen: the grid of champion cards and the detail panel
 * (portrait, stats, passive and ability cards) for the selected champion.
 * The champion picked is remembered for next time (localStorage); in a room,
 * champions teammates play are marked and can't be picked (setTaken).
 */

import {
  CHAMPION_DEFINITIONS,
  getAllChampionDefinitions,
  getAbilityDefinition,
  getPassiveDefinition,
  type ChampionDefinition,
} from "@siege/shared";
import { createAbilityCard, createPassiveCard } from "./abilityCards";
import { swapFor } from "./abilityDialog";
import { showPortrait } from "./portraits";
import { championGridColumns } from "./championGrid";

/**
 * Champions available for selection.
 * Filter to only show finished/polished champions.
 */
export const ENABLED_CHAMPIONS = ['vex', 'lume', 'vile', 'warrior', 'magnus', 'elara', 'gorath', 'uruk', 'oitboil', 'elora', 'caelum', 'fenris', 'calamitus', 'protobot', 'hop', 'zhakrul', 'kip', 'nocthar'];

const CHAMPION_KEY = "siege-champion";

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

  // State
  private selectedChampionId: string = "lume";
  /** Champions a teammate plays, with who (in a room) */
  private taken = new Map<string, string>();

  /** The player picked a champion (not called for select()) */
  onPick: ((championId: string) => void) | null = null;

  constructor(getEl: (id: string) => HTMLElement) {
    this.championGrid = getEl("champion-grid");
    this.detailPortrait = getEl("detail-portrait");
    this.detailName = getEl("detail-name");
    this.detailTitle = getEl("detail-title");
    this.detailClass = getEl("detail-class");
    this.detailStats = getEl("detail-stats");
    this.detailPassive = getEl("detail-passive");
    this.detailAbilities = getEl("detail-abilities");

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
    // Even rows (championGrid.ts)
    this.championGrid.style.setProperty("--columns", String(championGridColumns(champions.length)));

    // The champion picked last time, or the first
    const saved = readSavedChampion();
    const initial = champions.find(c => c.id === saved) ?? champions[0];
    if (initial) this.select(initial.id);
  }

  /**
   * Mark the champions teammates play: they can't be picked. Keeps the
   * selection; the server keeps the player off a taken champion.
   */
  setTaken(taken: Map<string, string>): void {
    this.taken = taken;
    this.championGrid?.querySelectorAll<HTMLElement>(".champion-card").forEach((card) => {
      const by = taken.get(card.dataset.championId ?? "");
      card.classList.toggle("taken", by !== undefined);
      card.title = by !== undefined ? `${by} plays this champion` : "";
    });
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
    showPortrait(portrait, champion.id);

    const name = document.createElement("div");
    name.className = champion.name.length > 9 ? "champion-card-name long" : "champion-card-name";
    name.textContent = champion.name;

    const championClass = document.createElement("div");
    championClass.className = "champion-card-class";
    championClass.textContent = champion.class;

    card.appendChild(portrait);
    card.appendChild(name);
    card.appendChild(championClass);

    // Click handler
    card.addEventListener("click", () => {
      if (this.taken.has(champion.id) || champion.id === this.selectedChampionId) return;
      this.select(champion.id);
      saveChampion(champion.id);
      this.onPick?.(champion.id);
    });

    return card;
  }

  /**
   * Show a champion as selected (a click, or the server's word in a room).
   */
  select(championId: string): void {
    if (!CHAMPION_DEFINITIONS[championId]) return;
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
  }

  /**
   * Update the champion details panel.
   */
  private updateChampionDetails(championId: string): void {
    const champion = CHAMPION_DEFINITIONS[championId];
    if (!champion) return;

    // Update portrait
    if (this.detailPortrait) {
      showPortrait(this.detailPortrait, championId);
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

        // A slot swapped for a while (Nocthar's colossus) says what it becomes
        const swap = swapFor(champion, slot);
        const swapDef = swap ? getAbilityDefinition(swap.abilityId) : undefined;
        this.detailAbilities.appendChild(createAbilityCard(slot, abilityDef, stats, championId,
          swap && swapDef ? { label: swap.label, ability: swapDef } : undefined));
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

function readSavedChampion(): string | null {
  try {
    return localStorage.getItem(CHAMPION_KEY);
  } catch {
    return null;
  }
}

function saveChampion(championId: string): void {
  try {
    localStorage.setItem(CHAMPION_KEY, championId);
  } catch {
    // Storage unavailable: the first champion next visit
  }
}
