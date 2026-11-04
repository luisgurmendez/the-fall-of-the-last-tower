/**
 * An account's profile (#screen-profile), from the menu's account line or a
 * name on a match's scoreboard. Two tabs:
 *
 * - PROFILE: the rank's emblem big (rankEmblem.ts), the tier and rating, the
 *   bar toward the next tier and the peak; the record and the numbers per
 *   match (KDA, CS, gold, damage); the recent form and the rating's trend;
 *   the most played champions.
 * - MATCH HISTORY: the latest matches (practice isn't kept), more at a time.
 *   A click on a match opens its scoreboard under it: both teams, each
 *   champion's player, level, KDA, CS, gold and items.
 *
 * Profiles are public (GET /api/profile/<name>, /api/matches/<id>).
 */

import { CHAMPION_DEFINITIONS, MAPS, isMapId, tierFor } from "@siege/shared";
import { getItemDefinition } from "@/data/items";
import { getItemIconUrl } from "@/ui/itemIcons";
import { accountErrorMessage, type AccountClient, type MatchInfo, type MatchPlayerInfo, type MatchSummaryInfo, type ProfileInfo } from "./account";
import { showPortrait } from "./portraits";
import {
  formatDuration, formatKda, formatPlayedAt, formatRatingChange, kdaRatio, ratingTrend, recentForm, sparkline, tierBar, tierName, winRate,
} from "./profileFormat";
import { rankEmblem } from "./rankEmblem";

/** Most played champions shown */
const TOP_CHAMPIONS = 3;
/** Results in the recent form */
const RECENT = 10;
/** The rating trend's box (CSS pixels) */
const TREND_WIDTH = 220;
const TREND_HEIGHT = 56;

export class ProfileScreen {
  private readonly head = getEl("profile-head");
  private readonly stats = getEl("profile-stats");
  private readonly champions = getEl("profile-champions");
  private readonly overviewTab = getEl("btn-profile-overview");
  private readonly historyTab = getEl("btn-profile-history");
  private readonly list = getEl("profile-matches");
  private readonly more = getEl("btn-profile-more") as HTMLButtonElement;
  private readonly error = getEl("profile-error");
  /** Whose profile is open */
  private name = "";
  /** The oldest match shown: the next page is before it */
  private oldest: number | null = null;
  /** Counts the profiles opened: an answer for an earlier one is dropped */
  private opened = 0;
  /** Matches already fetched, by id */
  private readonly matches = new Map<number, MatchInfo>();

  constructor(
    private readonly client: AccountClient,
    /** Show a menu screen: the profile, or back to the menu */
    private readonly show: (screen: "profile" | "menu") => void,
  ) {
    getEl("btn-profile-back").addEventListener("click", () => this.show("menu"));
    this.more.addEventListener("click", () => void this.loadPage());
    this.overviewTab.addEventListener("click", () => this.showTab("overview"));
    this.historyTab.addEventListener("click", () => this.showTab("history"));
  }

  /** PROFILE or MATCH HISTORY */
  private showTab(tab: "overview" | "history"): void {
    this.overviewTab.classList.toggle("active", tab === "overview");
    this.historyTab.classList.toggle("active", tab === "history");
    getEl("profile-overview").hidden = tab !== "overview";
    getEl("profile-history").hidden = tab !== "history";
  }

  /** Open an account's profile */
  open(name: string): void {
    this.name = name;
    this.oldest = null;
    this.opened++;
    this.head.replaceChildren(el("div", "profile-name", name), el("div", "profile-loading", "Loading..."));
    this.stats.replaceChildren();
    this.champions.replaceChildren();
    this.showTab("overview");
    this.list.replaceChildren();
    this.error.textContent = "";
    this.more.hidden = true;
    this.show("profile");
    void this.loadPage();
  }

  private async loadPage(): Promise<void> {
    const opened = this.opened;
    const first = this.oldest === null;
    this.more.disabled = true;
    const answer = await this.client.profile(this.name, this.oldest ?? undefined);
    // Another profile was opened meanwhile
    if (opened !== this.opened) return;
    this.more.disabled = false;
    if (!answer.ok) {
      if (first) this.head.replaceChildren(el("div", "profile-name", this.name));
      this.error.textContent = accountErrorMessage(answer.error);
      this.more.hidden = true;
      return;
    }
    this.error.textContent = "";
    if (first) {
      this.renderHead(answer.profile);
      this.renderStats(answer.profile, answer.matches);
      this.renderChampions(answer.profile);
      if (answer.matches.length === 0) {
        this.list.append(el("div", "profile-empty", "No matches yet (practice isn't kept)"));
      }
    }
    for (const match of answer.matches) this.list.append(this.matchRow(match));
    this.oldest = answer.matches[answer.matches.length - 1]?.id ?? this.oldest;
    this.more.hidden = !answer.more;
  }

  /** The emblem big, the name, the tier and rating, the bar toward the next tier, the peak */
  private renderHead(profile: ProfileInfo): void {
    const ranked = profile.ratedGames > 0;
    const tier = ranked ? profile.tier : null;
    const info = el("div", "profile-hero-info");
    info.append(
      el("div", "profile-name", profile.name),
      el("div", `profile-tier-name tier-${tier ?? "unranked"}`, ranked ? tierName(profile.tier).toUpperCase() : "UNRANKED"),
    );
    if (ranked) {
      const bar = tierBar(profile.rating);
      const track = el("div", "profile-bar");
      const fill = el("div", `profile-bar-fill tier-${profile.tier}`);
      fill.style.width = `${bar.percent}%`;
      track.append(fill);
      const rating = el("div", "profile-rating");
      rating.append(el("span", "profile-rating-number", String(profile.rating)), el("span", "profile-note", " rating"));
      info.append(rating, track, el("div", "profile-note", bar.label));
      if (profile.peakRating > profile.rating) {
        const peak = el("div", "profile-peak");
        peak.append(el("span", "profile-note", `Peak ${profile.peakRating}`), rankEmblem(tierOfPeak(profile), 20));
        info.append(peak);
      }
    } else {
      info.append(el("div", "profile-note", "Play a match against other players to get a rank"));
    }
    const hero = el("div", "profile-hero");
    hero.append(rankEmblem(tier, 192), info);
    this.head.replaceChildren(hero);
  }

  /** The record, the numbers per match, the recent form and the rating's trend */
  private renderStats(profile: ProfileInfo, matches: MatchSummaryInfo[]): void {
    const cards: HTMLElement[] = [];
    const card = (title: string, value: string, note: string, valueClass = "") => {
      const box = el("div", "profile-stat");
      box.append(el("div", "profile-stat-title", title), el("div", `profile-stat-value ${valueClass}`.trim(), value), el("div", "profile-note", note));
      cards.push(box);
    };
    card("RECORD", `${profile.wins}W ${profile.losses}L`, `${winRate(profile.wins, profile.losses)} won`);
    card("RATED", String(profile.ratedGames), profile.ratedGames === 1 ? "match" : "matches");
    const averages = profile.averages;
    if (averages) {
      card("KDA", `${averages.kills} / ${averages.deaths} / ${averages.assists}`, `${kdaRatio(averages.kills, averages.deaths, averages.assists)} ratio`);
      card("CS", String(averages.cs), "per match");
      card("GOLD", averages.gold.toLocaleString(), "per match");
      card("DAMAGE", averages.damageToChampions.toLocaleString(), "to champions per match");
    }
    const grid = el("div", "profile-stat-grid");
    grid.append(...cards);

    const form = recentForm(matches, RECENT);
    const trend = ratingTrend(matches);
    const strip = el("div", "profile-form-row");
    if (form.length > 0) {
      const recent = el("div", "profile-form");
      recent.append(el("div", "profile-stat-title", "RECENT"));
      const chips = el("div", "profile-form-chips");
      for (const result of form) chips.append(el("span", `profile-form-chip ${result === "W" ? "won" : "lost"}`, result));
      recent.append(chips);
      strip.append(recent);
    }
    const points = sparkline(trend, TREND_WIDTH, TREND_HEIGHT, 4);
    if (points) {
      const box = el("div", "profile-trend");
      box.append(el("div", "profile-stat-title", "RATING"));
      box.insertAdjacentHTML("beforeend",
        `<svg class="profile-trend-line" width="${TREND_WIDTH}" height="${TREND_HEIGHT}" viewBox="0 0 ${TREND_WIDTH} ${TREND_HEIGHT}">` +
        `<polyline points="${points}" /></svg>`);
      strip.append(box);
    }
    this.stats.replaceChildren(grid, ...(strip.childElementCount > 0 ? [strip] : []));
  }

  /** Most played champions: games, win rate and KDA */
  private renderChampions(profile: ProfileInfo): void {
    if (profile.champions.length === 0) return;
    const cards = profile.champions.slice(0, TOP_CHAMPIONS).map(({ championId, games, wins, kills, deaths, assists }) => {
      const card = el("div", "profile-champion");
      const portrait = el("div", "profile-portrait");
      showPortrait(portrait, championId);
      const text = el("div", "profile-champion-text");
      text.append(
        el("div", "profile-champion-name", championName(championId)),
        el("div", "profile-note", `${games} ${games === 1 ? "game" : "games"} · ${winRate(wins, games - wins)} won`),
      );
      if (kills !== undefined && deaths !== undefined && assists !== undefined) {
        const per = (value: number) => Math.round((value / games) * 10) / 10;
        text.append(el("div", "profile-note", `${per(kills)} / ${per(deaths)} / ${per(assists)} · ${kdaRatio(kills, deaths, assists)} KDA`));
      }
      card.append(portrait, text);
      return card;
    });
    this.champions.replaceChildren(el("div", "profile-section-title", "MOST PLAYED"), el("div", "profile-champion-list"));
    this.champions.lastElementChild!.append(...cards);
  }

  /** A match in the list: its scoreboard opens under it on a click */
  private matchRow(match: MatchSummaryInfo): HTMLElement {
    const wrapper = el("div", "profile-match");
    const row = el("button", `profile-match-row ${match.won ? "won" : "lost"}`) as HTMLButtonElement;
    row.type = "button";

    const portrait = el("div", "profile-portrait");
    showPortrait(portrait, match.championId);

    const result = el("div", "profile-match-result");
    result.append(
      el("div", "profile-match-outcome", match.won ? "VICTORY" : "DEFEAT"),
      el("div", "profile-note", `${match.mode === "room" ? "Room" : "Queue"} · ${mapName(match.mapId)}`),
    );

    const kda = el("div", "profile-match-kda");
    kda.append(
      el("div", "", formatKda(match.kills, match.deaths, match.assists)),
      el("div", "profile-note", `${kdaRatio(match.kills, match.deaths, match.assists)} KDA`),
    );

    const farm = el("div", "profile-match-farm");
    farm.append(el("div", "", `${match.cs} CS`), el("div", "profile-note", `${match.gold.toLocaleString()} gold`));

    const when = el("div", "profile-match-when");
    when.append(el("div", "", formatDuration(match.duration)), el("div", "profile-note", formatPlayedAt(match.endedAt)));

    row.append(portrait, result, kda, farm, itemIcons(match.items), when, ratingChange(match, "unrated"));

    let board: HTMLElement | null = null;
    row.addEventListener("click", () => {
      if (board) {
        board.remove();
        board = null;
        row.classList.remove("open");
        return;
      }
      row.classList.add("open");
      board = el("div", "profile-scoreboard", "Loading...");
      wrapper.append(board);
      void this.fillScoreboard(board, match.id);
    });
    wrapper.append(row);
    return wrapper;
  }

  private async fillScoreboard(board: HTMLElement, id: number): Promise<void> {
    let match = this.matches.get(id);
    if (!match) {
      const answer = await this.client.match(id);
      if (!answer.ok) {
        board.textContent = accountErrorMessage(answer.error);
        return;
      }
      match = answer.match;
      this.matches.set(id, match);
    }
    board.replaceChildren(...[0, 1].map(side => this.team(match!, side)));
  }

  /** One team's lines on a match's scoreboard */
  private team(match: MatchInfo, side: number): HTMLElement {
    const team = el("div", `profile-team ${side === 0 ? "blue" : "red"}`);
    const won = match.winningSide === side;
    team.append(el("div", "profile-team-title", `${side === 0 ? "BLUE" : "RED"} · ${won ? "VICTORY" : "DEFEAT"}`));
    for (const player of match.players.filter(line => line.side === side)) team.append(this.playerLine(player));
    return team;
  }

  private playerLine(player: MatchPlayerInfo): HTMLElement {
    const line = el("div", "profile-line");
    const portrait = el("div", "profile-portrait small");
    showPortrait(portrait, player.championId);

    const who = el("div", "profile-line-who");
    const name = player.isBot ? el("span", "profile-note", "Bot") : el("span", player.account ? "profile-link" : "", player.name ?? "Guest");
    if (player.account && player.name) {
      const profileName = player.name;
      name.title = "Open their profile";
      name.addEventListener("click", () => this.open(profileName));
    }
    who.append(name, el("span", "profile-note", ` ${championName(player.championId)} · lvl ${player.level}`));

    line.append(
      portrait,
      who,
      el("div", "profile-line-kda", formatKda(player.kills, player.deaths, player.assists)),
      el("div", "profile-line-farm", `${player.cs} CS · ${player.gold.toLocaleString()}g`),
      itemIcons(player.items),
      ratingChange(player, ""),
    );
    return line;
  }
}

/** The rating change, green up and red down (`unrated` when it wasn't rated) */
function ratingChange(line: { ratingBefore: number | null; ratingAfter: number | null }, unrated: string): HTMLElement {
  const change = line.ratingBefore !== null && line.ratingAfter !== null ? line.ratingAfter - line.ratingBefore : null;
  const direction = change === null || change === 0 ? "" : change > 0 ? "up" : "down";
  return el("div", `profile-match-rating ${direction}`.trim(), formatRatingChange(line.ratingBefore, line.ratingAfter) || unrated);
}

/** The items' icons, an empty square for an empty slot */
function itemIcons(items: (string | null)[]): HTMLElement {
  const row = el("div", "profile-items");
  for (const itemId of items) {
    const slot = el("div", "profile-item");
    if (itemId) {
      const image = document.createElement("img");
      image.src = getItemIconUrl(itemId);
      image.alt = image.title = getItemDefinition(itemId)?.name ?? itemId;
      image.onerror = () => image.remove();
      slot.append(image);
    }
    row.append(slot);
  }
  return row;
}

/** The tier of the peak rating */
function tierOfPeak(profile: ProfileInfo): string {
  return tierFor(profile.peakRating).id;
}

function championName(championId: string): string {
  return CHAMPION_DEFINITIONS[championId]?.name ?? championId;
}

function mapName(mapId: string): string {
  return isMapId(mapId) ? MAPS[mapId].NAME : mapId;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
