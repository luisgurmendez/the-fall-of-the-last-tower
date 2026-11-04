/**
 * An account's profile (#screen-profile), from the menu's account line or a
 * name on a match's scoreboard: its rating and tier, wins, losses and win
 * rate, most played champions, and its latest matches (practice isn't kept),
 * more at a time. A click on a match opens its scoreboard under it: both
 * teams, each champion's player, level, KDA, CS, gold and items. Profiles
 * are public (GET /api/profile/<name>, /api/matches/<id>).
 */

import { CHAMPION_DEFINITIONS, MAPS, isMapId } from "@siege/shared";
import { getItemDefinition } from "@/data/items";
import { getItemIconUrl } from "@/ui/itemIcons";
import { accountErrorMessage, type AccountClient, type MatchInfo, type MatchPlayerInfo, type MatchSummaryInfo, type ProfileInfo } from "./account";
import { showPortrait } from "./portraits";
import { formatDuration, formatKda, formatPlayedAt, formatRatingChange, kdaRatio, ratingLine, winRate } from "./profileFormat";

/** Most played champions shown */
const TOP_CHAMPIONS = 5;

export class ProfileScreen {
  private readonly head = getEl("profile-head");
  private readonly champions = getEl("profile-champions");
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
  }

  /** Open an account's profile */
  open(name: string): void {
    this.name = name;
    this.oldest = null;
    this.opened++;
    this.head.replaceChildren(el("div", "profile-name", name), el("div", "profile-loading", "Loading..."));
    this.champions.replaceChildren();
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
      this.renderChampions(answer.profile);
      if (answer.matches.length === 0) {
        this.list.append(el("div", "profile-empty", "No matches yet (practice isn't kept)"));
      }
    }
    for (const match of answer.matches) this.list.append(this.matchRow(match));
    this.oldest = answer.matches[answer.matches.length - 1]?.id ?? this.oldest;
    this.more.hidden = !answer.more;
  }

  /** The name, the rating and tier, the record */
  private renderHead(profile: ProfileInfo): void {
    const badge = el("div", `profile-tier tier-${profile.tier}`, ratingLine(profile));
    const peak = profile.ratedGames > 0 && profile.peakRating > profile.rating
      ? el("div", "profile-note", `Peak ${profile.peakRating}`)
      : null;
    const record = el("div", "profile-record");
    record.append(
      el("span", "profile-wins", `${profile.wins}W`),
      el("span", "profile-losses", `${profile.losses}L`),
      el("span", "profile-note", `${winRate(profile.wins, profile.losses)} won`),
    );
    const rated = el("div", "profile-note", profile.ratedGames === 1 ? "1 rated match" : `${profile.ratedGames} rated matches`);
    this.head.replaceChildren(el("div", "profile-name", profile.name), badge, ...(peak ? [peak] : []), record, rated);
  }

  /** Most played champions, with their games and win rate */
  private renderChampions(profile: ProfileInfo): void {
    if (profile.champions.length === 0) return;
    const cards = profile.champions.slice(0, TOP_CHAMPIONS).map(({ championId, games, wins }) => {
      const card = el("div", "profile-champion");
      const portrait = el("div", "profile-portrait");
      showPortrait(portrait, championId);
      card.append(
        portrait,
        el("div", "profile-champion-name", championName(championId)),
        el("div", "profile-note", `${games} ${games === 1 ? "game" : "games"} · ${winRate(wins, games - wins)}`),
      );
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
