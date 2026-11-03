/**
 * TabScoreboard - Full scoreboard overlay shown when Tab key is held.
 *
 * Shows League-style scoreboard with both teams:
 * - Champion icon, summoner spells (allies' with their cooldowns), name, level
 * - K/D/A stats
 * - CS (creep score)
 * - Items (6 slots)
 * - Gold (hidden for enemies)
 *
 * Every champion in the match is listed from the start; one not seen yet
 * shows dashes, and one out of sight keeps the line it had when last seen,
 * but its kills, deaths and assists follow the kills it takes part in. Dead
 * champions' lines keep changing. Hovering an item or a summoner spell shows
 * its tooltip. When the match ends it stays up, titled with the result and
 * filled with the server's final stats, until the player moves on.
 */

import { ScreenEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import GameContext from '@/core/gameContext';
import { InputManager } from '@/core/input/InputManager';
import type { OnlineStateManager, MatchResult } from '@/core/OnlineStateManager';
import {
  EntityType,
  type ChampionSnapshot,
  type ItemSlot,
  type SummonerSpellState,
  getChampionDefinition,
} from '@siege/shared';
import { getItemDefinition } from '@/data/items';
import { drawItemIcon } from '@/ui/itemIcons';
import { getPortraitCanvas } from '@/ui/matchmaking/portraits';
import { drawPixelArt } from '@/render/pixelArt';
import { Dimensions } from '@/core/canvas';
import { getSummonerIcon } from '@/ui/summonerIcons';
import { drawSummonerTooltip } from '@/ui/hud/summoners';
import { drawItemTooltip } from '@/ui/hud/tooltips';

/** One champion's line */
interface ScoreboardRow {
  /** Its champion's entity id, or its player id (the final stats) */
  entityId?: string;
  playerId?: string;
  side: number;
  championId: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  /** Item ids by slot */
  items: (string | null)[];
  /** Its summoner spells (D, F), with their cooldowns when seen */
  summoners?: SummonerSpellState[];
  /** False for a champion not seen yet: its stats are unknown */
  known?: boolean;
}

/** A champion in the match, from the match data */
export interface ScoreboardPlayer {
  playerId?: string;
  entityId: string;
  championId: string;
  side: number;
  /** Their summoner spells (D, F) */
  summonerSpells?: string[];
}

/** Something hovered on the scoreboard that has a tooltip */
type HoverTarget =
  | { kind: 'item'; x: number; y: number; size: number; itemId: string; slot: number }
  | { kind: 'summoner'; x: number; y: number; size: number; spellId: string; slot: number };

/** Scoreboard layout configuration - BIGGER sizes */
const LAYOUT = {
  // Overall dimensions
  width: 990,
  headerHeight: 50,
  teamHeaderHeight: 40,
  rowHeight: 56,
  padding: 16,
  borderRadius: 8,

  // Column widths
  iconCol: 48,
  spellsCol: 40,
  nameCol: 160,
  levelCol: 50,
  kdaCol: 100,
  csCol: 60,
  itemsCol: 230,
  goldCol: 90,

  // Item display
  itemSize: 34,
  itemGap: 4,

  // Summoner spells: two stacked beside the portrait
  spellSize: 22,
  spellGap: 2,
};

/** Font sizes - MUCH BIGGER */
const FONT = {
  title: 26,
  large: 22,
  medium: 20,
  normal: 18,
  small: 16,
};

/** Colors */
const COLORS = {
  background: 'rgba(15, 15, 25, 0.96)',
  headerBg: 'rgba(30, 30, 50, 0.96)',
  teamBlue: 'rgba(52, 152, 219, 0.25)',
  teamRed: 'rgba(231, 76, 60, 0.25)',
  teamBlueBorder: '#3498db',
  teamRedBorder: '#e74c3c',
  rowHover: 'rgba(255, 255, 255, 0.05)',
  rowAlt: 'rgba(255, 255, 255, 0.03)',
  text: '#ffffff',
  textDim: '#aaaaaa',
  textGold: '#ffd700',
  border: '#3a3a5c',
  divider: '#2a2a4c',
};

export class TabScoreboard extends ScreenEntity {
  private stateManager: OnlineStateManager;
  private localSide: number;
  private inputManager: InputManager;
  /** Each champion's line when last seen, by entity id */
  private lastSeen = new Map<string, ScoreboardRow>();
  /** What's drawn this frame that has a tooltip */
  private hoverTargets: HoverTarget[] = [];

  constructor(
    stateManager: OnlineStateManager,
    localSide: number,
    private readonly roster: ScoreboardPlayer[] = [],
  ) {
    super('tab-scoreboard');
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.inputManager = InputManager.getInstance();
  }

  step(_ctx: GameContext): void {
    // Remember every champion in sight (and the dead ones kept aside), for when it leaves
    const champions = this.stateManager.getEntities()
      .filter(entity => entity.snapshot.entityType === EntityType.CHAMPION)
      .map(entity => entity.snapshot as ChampionSnapshot);
    for (const snapshot of [...champions, ...this.stateManager.getDeadChampions()]) {
      this.lastSeen.set(snapshot.entityId, {
        entityId: snapshot.entityId,
        side: snapshot.side,
        championId: snapshot.championId,
        level: snapshot.level,
        kills: snapshot.kills,
        deaths: snapshot.deaths,
        assists: snapshot.assists,
        cs: snapshot.cs,
        gold: snapshot.gold,
        items: (snapshot.items ?? []).map(item => item?.definitionId ?? null),
        summoners: snapshot.summoners,
      });
    }
  }

  /**
   * The lines to show: the final stats once the match is over, otherwise
   * what's been seen.
   */
  private getRows(result: MatchResult | null): ScoreboardRow[] {
    if (result && result.players.length > 0) return result.players;
    const rows = this.roster.map(player => this.withScore(this.lastSeen.get(player.entityId) ?? {
      entityId: player.entityId,
      side: player.side,
      championId: player.championId,
      level: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      gold: 0,
      items: [],
      known: false,
    }));
    // Anyone seen who isn't in the roster (no match data)
    for (const [entityId, row] of this.lastSeen) {
      if (!this.roster.some(player => player.entityId === entityId)) rows.push(row);
    }
    return rows;
  }

  /**
   * A line with its kills, deaths and assists brought up to the kills its
   * champion took part in since it was last seen
   */
  private withScore(row: ScoreboardRow): ScoreboardRow {
    const score = row.entityId ? this.stateManager.getScore(row.entityId) : undefined;
    if (!score) return row;
    return {
      ...row,
      kills: Math.max(row.kills, score.kills),
      deaths: Math.max(row.deaths, score.deaths),
      assists: Math.max(row.assists, score.assists),
      known: true,
    };
  }

  /** A line's summoner spells: as last seen, or the ones it picked (no cooldowns) */
  private summonersOf(row: ScoreboardRow): SummonerSpellState[] {
    if (row.summoners?.length) return row.summoners;
    const player = this.roster.find(player =>
      row.entityId ? player.entityId === row.entityId : player.playerId === row.playerId);
    return (player?.summonerSpells ?? []).map(id => ({ id, cooldownRemaining: 0, cooldown: 0 }));
  }

  render(): RenderElement {
    return this.createOverlayRender((ctx: GameContext) => {
      // Show while Tab is held, and for good once the match is over
      const result = this.stateManager.getMatchResult();
      if (!this.inputManager.isKeyDown('Tab') && !result) return;

      const { canvasRenderingContext: c } = ctx;
      const canvasWidth = Dimensions.w;
      const canvasHeight = Dimensions.h;

      // Split by team
      const rows = this.getRows(result);
      const blueTeam = rows.filter(row => row.side === 0);
      const redTeam = rows.filter(row => row.side === 1);

      // Calculate total height
      const numRows = Math.max(blueTeam.length, redTeam.length, 1);
      const totalHeight = LAYOUT.headerHeight +
        LAYOUT.teamHeaderHeight * 2 +
        LAYOUT.rowHeight * numRows * 2 +
        LAYOUT.padding * 5;

      // Center the scoreboard
      const x = (canvasWidth - LAYOUT.width) / 2;
      const y = (canvasHeight - totalHeight) / 2;

      // Draw main background
      c.fillStyle = COLORS.background;
      c.beginPath();
      c.roundRect(x, y, LAYOUT.width, totalHeight, LAYOUT.borderRadius);
      c.fill();
      c.strokeStyle = COLORS.border;
      c.lineWidth = 2;
      c.stroke();

      // Draw header
      this.drawHeader(c, x, y, result);

      this.hoverTargets = [];

      // Draw blue team section
      const blueY = y + LAYOUT.headerHeight + LAYOUT.padding;
      this.drawTeamSection(c, x, blueY, blueTeam, 0, result !== null);

      // Draw red team section
      const redY = blueY + LAYOUT.teamHeaderHeight + LAYOUT.rowHeight * Math.max(blueTeam.length, 1) + LAYOUT.padding * 2;
      this.drawTeamSection(c, x, redY, redTeam, 1, result !== null);

      if (result) {
        RenderUtils.renderBitmapText(c, 'Click or press any key to continue',
          canvasWidth / 2,
          y + totalHeight + LAYOUT.padding,
          { size: FONT.normal, color: COLORS.textDim, centered: true }
        );
      }

      this.drawHoverTooltip(c);
    });
  }

  /** The tooltip of the item or summoner spell under the mouse, if any */
  private drawHoverTooltip(c: CanvasRenderingContext2D): void {
    const mouse = this.inputManager.getMousePosition();
    if (!mouse) return;
    const hovered = this.hoverTargets.find(target =>
      mouse.x >= target.x && mouse.x < target.x + target.size && mouse.y >= target.y && mouse.y < target.y + target.size);
    if (!hovered) return;
    c.strokeStyle = COLORS.textGold;
    c.lineWidth = 2;
    c.strokeRect(hovered.x, hovered.y, hovered.size, hovered.size);
    if (hovered.kind === 'summoner') {
      drawSummonerTooltip(c, hovered.x, hovered.y, hovered.slot, hovered.spellId);
      return;
    }
    const definition = getItemDefinition(hovered.itemId);
    if (!definition) return;
    drawItemTooltip(c, hovered.x, hovered.y, {
      definition,
      slot: hovered.slot as ItemSlot,
      passiveCooldowns: new Map(),
      nextIntervalTick: new Map(),
    });
  }

  /**
   * Draw the scoreboard header with title.
   */
  private drawHeader(c: CanvasRenderingContext2D, x: number, y: number, result: MatchResult | null): void {
    // Header background
    c.fillStyle = COLORS.headerBg;
    c.beginPath();
    c.roundRect(x, y, LAYOUT.width, LAYOUT.headerHeight, [LAYOUT.borderRadius, LAYOUT.borderRadius, 0, 0]);
    c.fill();

    // Title: the result once the match is over
    const title = result ? (result.won ? 'VICTORY' : 'DEFEAT') : 'SCOREBOARD';
    const titleColor = result ? (result.won ? COLORS.textGold : COLORS.teamRedBorder) : COLORS.text;
    RenderUtils.renderBitmapText(c, title,
      x + LAYOUT.width / 2,
      y + LAYOUT.headerHeight / 2 - 10,
      { size: FONT.title, color: titleColor, centered: true }
    );

    // Game time (the match length once it's over)
    const gameTime = result ? result.duration : this.stateManager.getGameTime();
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    RenderUtils.renderBitmapText(c, timeStr,
      x + LAYOUT.width - LAYOUT.padding,
      y + LAYOUT.headerHeight / 2 - 8,
      { size: FONT.medium, color: COLORS.textDim, rightAlign: true }
    );
  }

  /**
   * Draw a team section (header + player rows).
   */
  private drawTeamSection(
    c: CanvasRenderingContext2D,
    x: number, y: number,
    players: ScoreboardRow[],
    side: number,
    matchOver: boolean
  ): void {
    const isBlue = side === 0;
    const teamColor = isBlue ? COLORS.teamBlueBorder : COLORS.teamRedBorder;
    const bgColor = isBlue ? COLORS.teamBlue : COLORS.teamRed;

    // Team header background
    c.fillStyle = bgColor;
    c.fillRect(x + 2, y, LAYOUT.width - 4, LAYOUT.teamHeaderHeight);

    // Team header border
    c.fillStyle = teamColor;
    c.fillRect(x + 2, y, 5, LAYOUT.teamHeaderHeight);

    // Team name
    const teamName = isBlue ? 'BLUE TEAM' : 'RED TEAM';
    RenderUtils.renderBitmapText(c, teamName,
      x + LAYOUT.padding + 10,
      y + LAYOUT.teamHeaderHeight / 2 - 8,
      { size: FONT.large, color: teamColor }
    );

    // Team total kills
    const totalKills = players.reduce((sum, row) => sum + row.kills, 0);
    RenderUtils.renderBitmapText(c, `Kills: ${totalKills}`,
      x + LAYOUT.width - LAYOUT.padding,
      y + LAYOUT.teamHeaderHeight / 2 - 8,
      { size: FONT.normal, color: COLORS.textDim, rightAlign: true }
    );

    // Column headers
    const headerY = y + LAYOUT.teamHeaderHeight;
    this.drawColumnHeaders(c, x, headerY);

    // Player rows
    const rowsY = headerY + 24;
    if (players.length === 0) {
      // Empty team placeholder
      c.fillStyle = COLORS.rowAlt;
      c.fillRect(x + 2, rowsY, LAYOUT.width - 4, LAYOUT.rowHeight);
      RenderUtils.renderBitmapText(c, 'No players',
        x + LAYOUT.width / 2,
        rowsY + LAYOUT.rowHeight / 2 - 8,
        { size: FONT.normal, color: COLORS.textDim, centered: true }
      );
    } else {
      for (let i = 0; i < players.length; i++) {
        const rowY = rowsY + i * LAYOUT.rowHeight;
        this.drawPlayerRow(c, x, rowY, players[i], i % 2 === 1, matchOver);
      }
    }
  }

  /**
   * Draw column headers.
   */
  private drawColumnHeaders(c: CanvasRenderingContext2D, x: number, y: number): void {
    let colX = x + LAYOUT.padding;

    // Skip the icon and summoner spell columns for header
    colX += LAYOUT.iconCol + LAYOUT.spellsCol + 10;

    RenderUtils.renderBitmapText(c, 'Champion', colX, y, { size: FONT.small, color: COLORS.textDim });
    colX += LAYOUT.nameCol;

    RenderUtils.renderBitmapText(c, 'Lv', colX, y, { size: FONT.small, color: COLORS.textDim });
    colX += LAYOUT.levelCol;

    RenderUtils.renderBitmapText(c, 'K/D/A', colX, y, { size: FONT.small, color: COLORS.textDim });
    colX += LAYOUT.kdaCol;

    RenderUtils.renderBitmapText(c, 'CS', colX, y, { size: FONT.small, color: COLORS.textDim });
    colX += LAYOUT.csCol;

    RenderUtils.renderBitmapText(c, 'Items', colX, y, { size: FONT.small, color: COLORS.textDim });
    colX += LAYOUT.itemsCol;

    RenderUtils.renderBitmapText(c, 'Gold', colX, y, { size: FONT.small, color: COLORS.textDim });
  }

  /**
   * Draw a single player row.
   */
  private drawPlayerRow(
    c: CanvasRenderingContext2D,
    x: number, y: number,
    row: ScoreboardRow,
    isAlt: boolean,
    matchOver: boolean
  ): void {
    const isAlly = row.side === this.localSide;

    // Row background
    c.fillStyle = isAlt ? COLORS.rowAlt : 'transparent';
    c.fillRect(x + 2, y, LAYOUT.width - 4, LAYOUT.rowHeight);

    // Divider line
    c.strokeStyle = COLORS.divider;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + LAYOUT.padding, y + LAYOUT.rowHeight);
    c.lineTo(x + LAYOUT.width - LAYOUT.padding, y + LAYOUT.rowHeight);
    c.stroke();

    let colX = x + LAYOUT.padding;
    const textY = y + LAYOUT.rowHeight / 2 - 8;

    // Champion portrait on a team-colored square
    const iconSize = LAYOUT.iconCol - 8;
    const iconY = y + (LAYOUT.rowHeight - iconSize) / 2;
    c.fillStyle = isAlly ? COLORS.teamBlueBorder : COLORS.teamRedBorder;
    c.fillRect(colX, iconY, iconSize, iconSize);
    const portrait = getPortraitCanvas(row.championId);
    if (portrait) {
      drawPixelArt(c, portrait, colX + 2, iconY + 2, iconSize - 4, iconSize - 4);
    }
    c.strokeStyle = COLORS.border;
    c.lineWidth = 2;
    c.strokeRect(colX, iconY, iconSize, iconSize);
    colX += LAYOUT.iconCol;

    // Summoner spells, D over F; allies' show their cooldowns
    const spellsTop = y + (LAYOUT.rowHeight - LAYOUT.spellSize * 2 - LAYOUT.spellGap) / 2;
    this.summonersOf(row).slice(0, 2).forEach((spell, slot) => {
      const spellY = spellsTop + slot * (LAYOUT.spellSize + LAYOUT.spellGap);
      this.drawSummonerSpell(c, colX, spellY, spell, isAlly && !matchOver, slot);
    });
    colX += LAYOUT.spellsCol + 10;

    // Champion name
    const champDef = getChampionDefinition(row.championId);
    const champName = champDef?.name || row.championId;
    RenderUtils.renderBitmapText(c, champName, colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.nameCol;

    // Level
    const known = row.known !== false;
    RenderUtils.renderBitmapText(c, known ? row.level.toString() : '-', colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.levelCol;

    // K/D/A
    const kdaStr = known ? `${row.kills}/${row.deaths}/${row.assists}` : '-';
    RenderUtils.renderBitmapText(c, kdaStr, colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.kdaCol;

    // CS
    RenderUtils.renderBitmapText(c, known ? row.cs.toString() : '-', colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.csCol;

    // Items (6 slots)
    const itemY = y + (LAYOUT.rowHeight - LAYOUT.itemSize) / 2;
    for (let i = 0; i < 6; i++) {
      const itemX = colX + i * (LAYOUT.itemSize + LAYOUT.itemGap);
      const itemId = row.items[i] ?? null;

      // Item slot background
      c.fillStyle = itemId ? '#333355' : '#1a1a2e';
      c.fillRect(itemX, itemY, LAYOUT.itemSize, LAYOUT.itemSize);
      c.strokeStyle = COLORS.border;
      c.lineWidth = 1;
      c.strokeRect(itemX, itemY, LAYOUT.itemSize, LAYOUT.itemSize);

      // Item icon, or its color until the art loads
      const item = itemId ? getItemDefinition(itemId) : undefined;
      if (item) {
        drawItemIcon(c, item, itemX + 1, itemY + 1, 1, () => {
          c.fillStyle = this.getItemColor(item.id);
          c.fillRect(itemX + 3, itemY + 3, LAYOUT.itemSize - 6, LAYOUT.itemSize - 6);
        });
        this.hoverTargets.push({ kind: 'item', x: itemX, y: itemY, size: LAYOUT.itemSize, itemId: item.id, slot: i });
      }
    }
    colX += LAYOUT.itemsCol;

    // Gold (hidden for enemies until the match is over)
    if (known && (isAlly || matchOver)) {
      const goldStr = Math.floor(row.gold).toString();
      RenderUtils.renderBitmapText(c, goldStr, colX, textY, {
        size: FONT.normal,
        color: COLORS.textGold,
      });
    } else {
      RenderUtils.renderBitmapText(c, '---', colX, textY, {
        size: FONT.normal,
        color: COLORS.textDim,
      });
    }
  }

  /** A summoner spell's icon, with the seconds left on its cooldown when they're shown */
  private drawSummonerSpell(
    c: CanvasRenderingContext2D,
    x: number, y: number,
    spell: SummonerSpellState,
    showCooldown: boolean,
    slot: number
  ): void {
    const size = LAYOUT.spellSize;
    c.fillStyle = '#1a1a2e';
    c.fillRect(x, y, size, size);
    const icon = getSummonerIcon(spell.id);
    if (icon) drawPixelArt(c, icon, x, y, size, size);
    if (showCooldown && spell.cooldownRemaining > 0) {
      c.fillStyle = 'rgba(0, 0, 0, 0.65)';
      c.fillRect(x, y, size, size * Math.min(1, spell.cooldownRemaining / Math.max(1, spell.cooldown)));
      RenderUtils.renderBitmapText(c, `${Math.ceil(spell.cooldownRemaining)}`, x + size / 2, y + size / 2 - 7, {
        size: 14,
        color: COLORS.text,
        centered: true,
        shadow: true,
      });
    }
    c.strokeStyle = COLORS.border;
    c.lineWidth = 1;
    c.strokeRect(x, y, size, size);
    this.hoverTargets.push({ kind: 'summoner', x, y, size, spellId: spell.id, slot });
  }

  /**
   * Get a color for an item based on its ID.
   */
  private getItemColor(itemId: string): string {
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 50%, 45%)`;
  }
}

export default TabScoreboard;
