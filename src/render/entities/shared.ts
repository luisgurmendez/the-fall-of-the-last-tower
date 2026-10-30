/**
 * Helpers shared by the entity renderers: team colors and color math.
 */

/**
 * Colors for different teams.
 */
export const TEAM_COLORS = {
  BLUE: "#3498db",
  RED: "#e74c3c",
  NEUTRAL: "#95a5a6",
};

/**
 * Lighten a color by a percentage.
 */
export function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}
