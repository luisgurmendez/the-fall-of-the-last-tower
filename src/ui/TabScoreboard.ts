/**
 * TabScoreboard - Full scoreboard overlay shown when Tab key is held.
 *
 * Shows League-style scoreboard with both teams:
 * - Champion icon, name, level
 * - K/D/A stats
 * - CS (creep score)
 * - Items (6 slots)
 * - Gold (hidden for enemies)
 */

import { ScreenEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import GameContext from '@/core/gameContext';
import { InputManager } from '@/core/input/InputManager';
import type { OnlineStateManager, InterpolatedEntity } from '@/core/OnlineStateManager';
import {
  EntityType,
  type ChampionSnapshot,
  getChampionDefinition,
} from '@siege/shared';

/** Scoreboard layout configuration - BIGGER sizes */
const LAYOUT = {
  // Overall dimensions
  width: 950,
  headerHeight: 50,
  teamHeaderHeight: 40,
  rowHeight: 56,
  padding: 16,
  borderRadius: 8,

  // Column widths
  iconCol: 48,
  nameCol: 160,
  levelCol: 50,
  kdaCol: 100,
  csCol: 60,
  itemsCol: 230,
  goldCol: 90,

  // Item display
  itemSize: 34,
  itemGap: 4,
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

  constructor(stateManager: OnlineStateManager, localSide: number) {
    super('tab-scoreboard');
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.inputManager = InputManager.getInstance();
  }

  step(ctx: GameContext): void {
    // No update logic needed - visibility is checked each frame
  }

  render(): RenderElement {
    return this.createOverlayRender((ctx: GameContext) => {
      // Only show when Tab is held
      if (!this.inputManager.isKeyDown('Tab')) return;

      const { canvasRenderingContext: c } = ctx;
      const canvasWidth = c.canvas.width;
      const canvasHeight = c.canvas.height;

      // Get all champion entities
      const entities = this.stateManager.getEntities();
      const champions = entities.filter(e => e.snapshot.entityType === EntityType.CHAMPION);

      // Split by team
      const blueTeam = champions.filter(e => (e.snapshot as ChampionSnapshot).side === 0);
      const redTeam = champions.filter(e => (e.snapshot as ChampionSnapshot).side === 1);

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
      this.drawHeader(c, x, y);

      // Draw blue team section
      const blueY = y + LAYOUT.headerHeight + LAYOUT.padding;
      this.drawTeamSection(c, x, blueY, blueTeam, 0);

      // Draw red team section
      const redY = blueY + LAYOUT.teamHeaderHeight + LAYOUT.rowHeight * Math.max(blueTeam.length, 1) + LAYOUT.padding * 2;
      this.drawTeamSection(c, x, redY, redTeam, 1);
    });
  }

  /**
   * Draw the scoreboard header with title.
   */
  private drawHeader(c: CanvasRenderingContext2D, x: number, y: number): void {
    // Header background
    c.fillStyle = COLORS.headerBg;
    c.beginPath();
    c.roundRect(x, y, LAYOUT.width, LAYOUT.headerHeight, [LAYOUT.borderRadius, LAYOUT.borderRadius, 0, 0]);
    c.fill();

    // Title
    RenderUtils.renderBitmapText(c, 'SCOREBOARD',
      x + LAYOUT.width / 2,
      y + LAYOUT.headerHeight / 2 - 10,
      { size: FONT.title, color: COLORS.text, centered: true }
    );

    // Game time
    const gameTime = this.stateManager.getGameTime();
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
    players: InterpolatedEntity[],
    side: number
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
    const totalKills = players.reduce((sum, p) => sum + (p.snapshot as ChampionSnapshot).kills, 0);
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
        this.drawPlayerRow(c, x, rowY, players[i], i % 2 === 1);
      }
    }
  }

  /**
   * Draw column headers.
   */
  private drawColumnHeaders(c: CanvasRenderingContext2D, x: number, y: number): void {
    let colX = x + LAYOUT.padding;

    // Skip icon column for header
    colX += LAYOUT.iconCol + 10;

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
    entity: InterpolatedEntity,
    isAlt: boolean
  ): void {
    const snapshot = entity.snapshot as ChampionSnapshot;
    const isAlly = snapshot.side === this.localSide;

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

    // Champion icon (placeholder - colored square)
    const iconSize = LAYOUT.iconCol - 8;
    const iconY = y + (LAYOUT.rowHeight - iconSize) / 2;
    c.fillStyle = isAlly ? COLORS.teamBlueBorder : COLORS.teamRedBorder;
    c.fillRect(colX, iconY, iconSize, iconSize);
    c.strokeStyle = COLORS.border;
    c.lineWidth = 2;
    c.strokeRect(colX, iconY, iconSize, iconSize);
    colX += LAYOUT.iconCol + 10;

    // Champion name
    const champDef = getChampionDefinition(snapshot.championId);
    const champName = champDef?.name || snapshot.championId;
    RenderUtils.renderBitmapText(c, champName, colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.nameCol;

    // Level
    RenderUtils.renderBitmapText(c, snapshot.level.toString(), colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.levelCol;

    // K/D/A
    const kdaStr = `${snapshot.kills}/${snapshot.deaths}/${snapshot.assists}`;
    RenderUtils.renderBitmapText(c, kdaStr, colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.kdaCol;

    // CS
    RenderUtils.renderBitmapText(c, snapshot.cs.toString(), colX, textY, {
      size: FONT.normal,
      color: COLORS.text,
    });
    colX += LAYOUT.csCol;

    // Items (6 slots)
    const itemY = y + (LAYOUT.rowHeight - LAYOUT.itemSize) / 2;
    for (let i = 0; i < 6; i++) {
      const itemX = colX + i * (LAYOUT.itemSize + LAYOUT.itemGap);
      const item = snapshot.items?.[i];

      // Item slot background
      c.fillStyle = item ? '#333355' : '#1a1a2e';
      c.fillRect(itemX, itemY, LAYOUT.itemSize, LAYOUT.itemSize);
      c.strokeStyle = COLORS.border;
      c.lineWidth = 1;
      c.strokeRect(itemX, itemY, LAYOUT.itemSize, LAYOUT.itemSize);

      // Item indicator (if has item)
      if (item) {
        c.fillStyle = this.getItemColor(item.definitionId);
        c.fillRect(itemX + 3, itemY + 3, LAYOUT.itemSize - 6, LAYOUT.itemSize - 6);
      }
    }
    colX += LAYOUT.itemsCol;

    // Gold (hidden for enemies)
    if (isAlly) {
      const goldStr = Math.floor(snapshot.gold).toString();
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
