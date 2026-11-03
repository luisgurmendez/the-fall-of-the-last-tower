/**
 * The post-match stats page: a table with a column per champion (blue team,
 * then red) and a line per stat (damage, healing, gold, wards...), from
 * GAME_END's totals. Each cell has a bar against the line's best, and the
 * best is in gold. The local player's column is lit.
 *
 * TabScoreboard draws it in its frame, as the second page of the final
 * scoreboard.
 */

import RenderUtils from '@/render/utils';
import { drawPixelArt } from '@/render/pixelArt';
import { getPortraitCanvas } from '@/ui/matchmaking/portraits';
import { SCOREBOARD_COLORS as COLORS, SCOREBOARD_FONT as FONT } from '@/ui/scoreboardStyle';
import { getChampionDefinition, type FinalPlayerStats } from '@siege/shared';

/** The stats, in the order they're listed */
const STATS: { label: string; value: (player: FinalPlayerStats) => number }[] = [
  { label: 'Damage to champions', value: player => player.totals.damageToChampions },
  { label: 'Damage dealt', value: player => player.totals.damageDealt },
  { label: 'Damage taken', value: player => player.totals.damageTaken },
  { label: 'Healing', value: player => player.totals.healing },
  { label: 'Damage to structures', value: player => player.totals.damageToStructures },
  { label: 'Gold earned', value: player => player.totals.goldEarned },
  { label: 'Minions killed', value: player => player.cs },
  { label: 'Wards placed', value: player => player.totals.wardsPlaced },
  { label: 'Wards destroyed', value: player => player.totals.wardsDestroyed },
  { label: 'Largest killing spree', value: player => player.totals.largestKillingSpree },
];

const LAYOUT = {
  padding: 16,
  labelCol: 230,
  maxCol: 120,
  teamGap: 16,
  headerHeight: 76,
  portraitSize: 40,
  rowHeight: 32,
  barHeight: 4,
};

/** How tall the stats page is */
export function matchStatsHeight(): number {
  return LAYOUT.padding * 2 + LAYOUT.headerHeight + STATS.length * LAYOUT.rowHeight;
}

/** 12450 → 12.4k */
function formatValue(value: number): string {
  if (value >= 10000) return `${(Math.floor(value / 100) / 10).toFixed(1)}k`;
  return Math.round(value).toString();
}

/** A champion's name cut to fit `width` */
function fitName(c: CanvasRenderingContext2D, name: string, width: number): string {
  let fitted = name;
  while (fitted.length > 1 && RenderUtils.measureBitmapText(c, fitted, FONT.tiny) > width) {
    fitted = fitted.slice(0, -1);
  }
  return fitted;
}

/**
 * Draw the stats page in a `width`-wide box from (x, y) (matchStatsHeight()
 * tall).
 */
export function drawMatchStats(
  c: CanvasRenderingContext2D,
  x: number, y: number, width: number,
  players: FinalPlayerStats[],
  localPlayerId: string | undefined,
): void {
  const columns = [...players].sort((a, b) => a.side - b.side);
  const hasRed = columns.some(player => player.side === 1);
  const gap = hasRed && columns.some(player => player.side === 0) ? LAYOUT.teamGap : 0;
  const available = width - LAYOUT.padding * 2 - LAYOUT.labelCol - gap;
  const colWidth = Math.min(LAYOUT.maxCol, available / Math.max(1, columns.length));
  const columnX = (index: number) => {
    const player = columns[index];
    return x + LAYOUT.padding + LAYOUT.labelCol + index * colWidth + (player.side === 1 ? gap : 0);
  };
  const top = y + LAYOUT.padding;
  const rowsTop = top + LAYOUT.headerHeight;
  const tableBottom = rowsTop + STATS.length * LAYOUT.rowHeight;

  // The local player's column, lit top to bottom
  const local = columns.findIndex(player => player.playerId === localPlayerId);
  if (local >= 0) {
    c.fillStyle = COLORS.localColumn;
    c.fillRect(columnX(local), top, colWidth, tableBottom - top);
  }

  // Portraits on their team's color, names under them
  columns.forEach((player, index) => {
    const cx = columnX(index) + colWidth / 2;
    const size = LAYOUT.portraitSize;
    const px = cx - size / 2;
    const py = top + 4;
    c.fillStyle = player.side === 0 ? COLORS.teamBlueBorder : COLORS.teamRedBorder;
    c.fillRect(px, py, size, size);
    const portrait = getPortraitCanvas(player.championId);
    if (portrait) drawPixelArt(c, portrait, px + 2, py + 2, size - 4, size - 4);
    const name = index === local ? 'You' : getChampionDefinition(player.championId)?.name ?? player.championId;
    RenderUtils.renderBitmapText(c, fitName(c, name, colWidth - 6), cx, py + size + 8, {
      size: FONT.tiny,
      color: index === local ? COLORS.textGold : COLORS.textDim,
      centered: true,
    });
  });

  // A line per stat: its label, then each champion's value and bar
  STATS.forEach((stat, row) => {
    const rowY = rowsTop + row * LAYOUT.rowHeight;
    if (row % 2 === 1) {
      c.fillStyle = COLORS.rowAlt;
      c.fillRect(x + 2, rowY, width - 4, LAYOUT.rowHeight);
    }
    RenderUtils.renderBitmapText(c, stat.label, x + LAYOUT.padding, rowY + LAYOUT.rowHeight / 2 - 8, {
      size: FONT.small,
      color: COLORS.textDim,
    });

    const values = columns.map(stat.value);
    const best = Math.max(0, ...values);
    values.forEach((value, index) => {
      const colX = columnX(index);
      const isBest = best > 0 && value === best;
      RenderUtils.renderBitmapText(c, formatValue(value), colX + colWidth / 2, rowY + 5, {
        size: FONT.small,
        color: isBest ? COLORS.textGold : COLORS.text,
        centered: true,
      });
      // The bar, against the line's best
      const barWidth = colWidth - 20;
      const barY = rowY + LAYOUT.rowHeight - LAYOUT.barHeight - 5;
      c.fillStyle = COLORS.divider;
      c.fillRect(colX + 10, barY, barWidth, LAYOUT.barHeight);
      if (best > 0 && value > 0) {
        c.fillStyle = columns[index].side === 0 ? COLORS.teamBlueBorder : COLORS.teamRedBorder;
        c.fillRect(colX + 10, barY, Math.max(1, barWidth * value / best), LAYOUT.barHeight);
      }
    });
  });
}
