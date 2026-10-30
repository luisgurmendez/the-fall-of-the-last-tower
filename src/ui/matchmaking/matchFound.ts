/**
 * Match found screen: each team's champion and the loading bar shown before
 * the game starts.
 */

import { CHAMPION_DEFINITIONS } from "@siege/shared";
import { CHAMPION_ICONS } from "./championSelect";

/**
 * Match found elements and the loading progress.
 */
export class MatchFoundScreen {
  // Match found elements
  private blueChampion: HTMLElement;
  private redChampion: HTMLElement;
  private loadingBar: HTMLElement;

  // State
  private loadingProgress: number = 0;

  constructor(getEl: (id: string) => HTMLElement) {
    this.blueChampion = getEl("blue-champion");
    this.redChampion = getEl("red-champion");
    this.loadingBar = getEl("loading-bar");
  }

  /**
   * Show each team's champion.
   */
  showTeams(data: any): void {
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
  }

  /**
   * Format champion name for display.
   */
  private formatChampionName(id: string): string {
    const champion = CHAMPION_DEFINITIONS[id];
    return champion?.name || id.charAt(0).toUpperCase() + id.slice(1);
  }

  /**
   * Start loading animation. Calls onLoaded half a second after the bar fills.
   */
  startLoadingAnimation(onLoaded: () => void): void {
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
          onLoaded();
        }, 500);
      } else {
        if (this.loadingBar)
          this.loadingBar.style.width = `${this.loadingProgress}%`;
      }
    }, 200);
  }

  /**
   * Reset the loading progress.
   */
  resetProgress(): void {
    this.loadingProgress = 0;
  }
}
