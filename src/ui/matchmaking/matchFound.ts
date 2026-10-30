/**
 * Match found screen: each team's champion and the loading bar shown before
 * the game starts.
 */

import { CHAMPION_DEFINITIONS } from "@siege/shared";
import { CHAMPION_ICONS } from "./portraits";

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
  private loadingInterval: ReturnType<typeof setInterval> | null = null;
  private loadedTimeout: ReturnType<typeof setTimeout> | null = null;

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
    this.stopLoadingAnimation();
    this.loadingProgress = 0;
    if (this.loadingBar) {
      this.loadingBar.style.width = "0%";
    }

    this.loadingInterval = setInterval(() => {
      this.loadingProgress += Math.random() * 15 + 5;

      if (this.loadingProgress >= 100) {
        this.loadingProgress = 100;
        if (this.loadingBar) this.loadingBar.style.width = "100%";
        this.stopLoadingAnimation();

        // Transition to game
        this.loadedTimeout = setTimeout(() => {
          this.loadedTimeout = null;
          onLoaded();
        }, 500);
      } else {
        if (this.loadingBar)
          this.loadingBar.style.width = `${this.loadingProgress}%`;
      }
    }, 200);
  }

  /**
   * Stop the loading animation without starting the game.
   */
  private stopLoadingAnimation(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    if (this.loadedTimeout) {
      clearTimeout(this.loadedTimeout);
      this.loadedTimeout = null;
    }
  }

  /**
   * Stop the loading animation (the game won't start from it) and reset the progress.
   */
  resetProgress(): void {
    this.stopLoadingAnimation();
    this.loadingProgress = 0;
  }
}
