/**
 * Loading screen, from the match found until the game starts: a card per
 * player (portrait, champion, player name, summoner spells and loading
 * progress), blue team then red, with the map, the mode and a rotating tip.
 * On a short window the cards shrink until it all fits.
 *
 * The progress is real: the screen preloads the match's art (matchAssets.ts)
 * and the bars follow it. They never run ahead of the loading, take at least
 * MIN_DISPLAY_MS to fill so the screen doesn't flash, and fill after
 * MAX_LOADING_MS even if some art never answered.
 */

import { CHAMPION_DEFINITIONS, MOBAConfig, SUMMONER_SPELLS, type SummonerSpellId } from "@siege/shared";
import { summonerIconUrl } from "@/ui/summonerIcons";
import { preloadMatchAssets } from "./matchAssets";
import { showPortrait } from "./portraits";
import { showRandomTip } from "./tips";

/**
 * A player in the match start message. The server doesn't send the optional
 * fields yet; the cards show them once it does.
 */
export interface LoadingScreenPlayer {
  playerId: string;
  championId: string;
  /** 0 = blue, 1 = red */
  side: number;
  /** Display name */
  name?: string;
  /** Played by a server-side bot */
  isBot?: boolean;
  /** The player's two summoner spell ids */
  summonerSpells?: string[];
}

/**
 * What the screen reads from the match start message.
 */
export interface LoadingScreenData {
  yourSide?: number;
  players?: LoadingScreenPlayer[];
}

/** Shortest time the bars take to fill, so the screen doesn't flash */
const MIN_DISPLAY_MS = 1500;
/** The bars fill after this long even if some art never answered */
const MAX_LOADING_MS = 15000;
/** Pause on the full bars before the game starts */
const READY_PAUSE_MS = 400;
/** How often the bars are updated */
const TICK_MS = 50;
/** How often the tip changes */
const TIP_MS = 5000;
/** On a short window the cards shrink to fit, down to this much */
const MIN_CARD_ZOOM = 0.6;
/** Teams this size or smaller face each other side by side, bigger ones in two rows */
const SIDE_BY_SIDE_TEAM_SIZE = 2;

/** Where matchConnection.ts keeps the local player's ID */
const PLAYER_ID_KEY = "siege-player-id";

/** A player's card, with the parts that change while loading */
interface PlayerCard {
  card: HTMLElement;
  fill: HTMLElement;
  percent: HTMLElement;
  /** Bots run on the server, so they're ready from the start */
  isBot: boolean;
}

/**
 * Bots: flagged by the server, or named bot-<playerId> (practice matches).
 */
function isBot(player: LoadingScreenPlayer): boolean {
  return player.isBot === true || String(player.playerId).startsWith("bot-");
}

function createDiv(className: string, text?: string): HTMLElement {
  const div = document.createElement("div");
  div.className = className;
  if (text !== undefined) div.textContent = text;
  return div;
}

/**
 * Loading screen elements and the loading progress.
 */
export class MatchFoundScreen {
  // Loading screen elements
  private teams: HTMLElement;
  private blueCards: HTMLElement;
  private redCards: HTMLElement;
  private mapLabel: HTMLElement;
  private modeLabel: HTMLElement;
  private status: HTMLElement;
  private tip: HTMLElement;

  // State
  private championIds: string[] = [];
  private cards: PlayerCard[] = [];
  /** Assets done (loaded or failed) out of the total */
  private loaded = 0;
  private total = 0;
  private startTime = 0;
  /** Changed on each start and reset, so a stale preload's progress is ignored */
  private loadId = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private tipInterval: ReturnType<typeof setInterval> | null = null;
  private loadedTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(getEl: (id: string) => HTMLElement) {
    this.teams = getEl("loading-teams");
    this.blueCards = getEl("loading-blue-team");
    this.redCards = getEl("loading-red-team");
    this.mapLabel = getEl("loading-map");
    this.modeLabel = getEl("loading-mode");
    this.status = getEl("loading-status");
    this.tip = getEl("loading-tip");
  }

  /**
   * Show a card per player, the map and the mode.
   */
  showTeams(data: LoadingScreenData): void {
    const players = Array.isArray(data.players) ? data.players : [];
    const localPlayer = this.findLocalPlayer(players, data.yourSide);
    const blue = players.filter((player) => player.side === 0);
    const red = players.filter((player) => player.side !== 0);

    this.championIds = [...new Set(players.map((player) => player.championId))];
    this.cards = [];
    this.blueCards?.replaceChildren(
      ...blue.map((player, index) => this.createCard(player, player === localPlayer, index)),
    );
    this.redCards?.replaceChildren(
      ...red.map((player, index) => this.createCard(player, player === localPlayer, index)),
    );

    if (this.teams) {
      const teamSize = Math.max(blue.length, red.length);
      this.teams.dataset.layout = teamSize <= SIDE_BY_SIDE_TEAM_SIZE ? "side" : "rows";
    }
    if (this.mapLabel) this.mapLabel.textContent = MOBAConfig.NAME;
    if (this.modeLabel) {
      const size = `${blue.length}v${red.length}`;
      const bots = red.filter(isBot).length;
      this.modeLabel.textContent = players.some(isBot) ? `Practice ${size} vs bot${bots > 1 ? "s" : ""}` : `${size} match`;
    }
    this.render(0);
  }

  /**
   * The local player: the one with our player ID, or else the first human on
   * our side.
   */
  private findLocalPlayer(
    players: LoadingScreenPlayer[],
    yourSide: number | undefined,
  ): LoadingScreenPlayer | undefined {
    const playerId = sessionStorage.getItem(PLAYER_ID_KEY);
    return (
      players.find((player) => player.playerId === playerId) ??
      players.find((player) => player.side === yourSide && !isBot(player))
    );
  }

  /**
   * A player's card: portrait with the champion's class, champion name and
   * title, summoner spells and player name, and the loading bar.
   */
  private createCard(player: LoadingScreenPlayer, isLocal: boolean, index: number): HTMLElement {
    const champion = CHAMPION_DEFINITIONS[player.championId];
    const championName = this.formatChampionName(player.championId);
    const bot = isBot(player);

    const card = createDiv(`loading-card ${player.side === 0 ? "blue" : "red"}`);
    card.classList.toggle("local", isLocal);
    // Cards come in one after another
    card.style.setProperty("--card-index", String(index));

    // Portrait. Until the art loads (or without art) the frame shows the
    // champion's initial instead of the portrait module's emoji.
    const frame = createDiv("loading-card-frame");
    const art = createDiv("loading-card-art");
    showPortrait(art, player.championId);
    art.textContent = "";
    art.dataset.initial = championName.charAt(0);
    frame.appendChild(art);
    if (champion) frame.appendChild(createDiv("loading-card-class", champion.class));

    // Summoner spells: each one's icon and name (what it does on hover)
    const spells = createDiv("loading-card-spells");
    const spellIds = Array.isArray(player.summonerSpells) ? player.summonerSpells.slice(0, 2) : [];
    for (const spellId of spellIds) {
      const definition = SUMMONER_SPELLS[spellId as SummonerSpellId];
      const spell = createDiv("loading-card-spell");
      spell.dataset.spell = String(spellId);
      if (definition) spell.title = `${definition.name}: ${definition.description}`;
      const iconBox = createDiv("loading-card-spell-icon");
      const icon = document.createElement("img");
      icon.src = summonerIconUrl(String(spellId));
      icon.alt = "";
      iconBox.appendChild(icon);
      const name = createDiv("loading-card-spell-name", definition?.name ?? String(spellId));
      if (definition) name.style.color = definition.color;
      spell.append(iconBox, name);
      spells.appendChild(spell);
    }
    const playerName = player.name || (bot ? "Bot" : isLocal ? "You" : "Player");
    const playerRow = createDiv("loading-card-player");
    playerRow.append(spells, createDiv("loading-card-player-name", playerName));

    const progress = createDiv("loading-card-progress");
    const fill = createDiv("loading-card-progress-fill");
    progress.appendChild(fill);
    const percent = createDiv("loading-card-percent");

    card.append(
      frame,
      createDiv("loading-card-champion", championName),
      createDiv("loading-card-title", champion?.title ?? ""),
      playerRow,
      progress,
      percent,
    );
    this.cards.push({ card, fill, percent, isBot: bot });
    return card;
  }

  /**
   * Format champion name for display.
   */
  private formatChampionName(id: string): string {
    const champion = CHAMPION_DEFINITIONS[id];
    return champion?.name || id.charAt(0).toUpperCase() + id.slice(1);
  }

  /**
   * Preload the match's art for the teams shown, fill the bars as it loads
   * and call onLoaded a moment after they're full.
   */
  startLoading(onLoaded: () => void): void {
    this.stopLoading();
    this.fitToWindow();
    const loadId = ++this.loadId;
    this.loaded = 0;
    this.total = 0;
    this.startTime = performance.now();
    this.render(0);

    try {
      preloadMatchAssets(this.championIds, (loaded, total) => {
        if (loadId !== this.loadId) return;
        this.loaded = loaded;
        this.total = total;
      });
    } catch (error) {
      // Nothing to wait for then: the bars fill in MIN_DISPLAY_MS
      console.warn("[MatchFoundScreen] Preloading failed:", error);
    }

    showRandomTip(this.tip);
    this.tipInterval = setInterval(() => showRandomTip(this.tip), TIP_MS);

    this.tickInterval = setInterval(() => {
      const progress = this.getProgress();
      this.render(progress);
      if (progress < 1) return;

      if (this.tickInterval) clearInterval(this.tickInterval);
      this.tickInterval = null;
      this.loadedTimeout = setTimeout(() => {
        this.loadedTimeout = null;
        this.stopLoading();
        onLoaded();
      }, READY_PAUSE_MS);
    }, TICK_MS);
  }

  /**
   * On a short window the cards shrink until the whole screen (map to tip)
   * fits, measured once it's showing
   */
  private fitToWindow(): void {
    const teams = this.teams;
    const container = teams?.closest<HTMLElement>(".matchmaking-container");
    if (!teams || !container) return;
    teams.style.zoom = "";
    requestAnimationFrame(() => {
      const overflow = container.scrollHeight - container.clientHeight;
      const height = teams.getBoundingClientRect().height;
      if (overflow > 0 && height > 0) teams.style.zoom = String(Math.max(MIN_CARD_ZOOM, (height - overflow) / height));
    });
  }

  /**
   * How much of the loading is shown as done, 0 to 1: the share of the
   * assets done, but filling no faster than MIN_DISPLAY_MS allows, and all of
   * it after MAX_LOADING_MS.
   */
  private getProgress(): number {
    const elapsed = performance.now() - this.startTime;
    const assets = this.total === 0 || elapsed >= MAX_LOADING_MS ? 1 : this.loaded / this.total;
    return Math.min(assets, elapsed / MIN_DISPLAY_MS, 1);
  }

  /**
   * Update the bars and the status line. Bot cards are always full.
   */
  private render(progress: number): void {
    const percent = Math.floor(progress * 100);
    for (const { card, fill, percent: label, isBot: bot } of this.cards) {
      const shown = bot ? 100 : percent;
      fill.style.width = `${shown}%`;
      label.textContent = shown >= 100 ? "Ready" : `${shown}%`;
      card.classList.toggle("ready", shown >= 100);
    }
    if (this.status) {
      this.status.textContent = percent >= 100 ? "Starting game..." : "Loading match...";
    }
  }

  /**
   * Stop updating the bars and the tip without starting the game.
   */
  private stopLoading(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
      this.tipInterval = null;
    }
    if (this.loadedTimeout) {
      clearTimeout(this.loadedTimeout);
      this.loadedTimeout = null;
    }
  }

  /**
   * Stop the loading (the game won't start from it) and reset the progress.
   */
  resetProgress(): void {
    this.stopLoading();
    this.loadId++;
    this.loaded = 0;
    this.total = 0;
  }
}
