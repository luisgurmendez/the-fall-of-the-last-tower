/**
 * VFXColors - Color palette of each champion, used by the ability VFX
 * definitions in ./champions/.
 */

/**
 * Champion color palettes.
 */
export const CHAMPION_COLORS = {
  elara: {
    primary: '#FFD700', // Gold
    secondary: '#FFFFFF', // White
    accent: '#FFF9C4', // Soft Yellow
  },
  gorath: {
    primary: '#8B7355', // Brown
    secondary: '#708090', // Stone Gray
    accent: '#FF8C00', // Orange
  },
  lume: {
    primary: '#FFE566', // Warm Gold
    secondary: '#FFF9E0', // Soft Yellow
    accent: '#FFFFFF', // White
  },
  magnus: {
    primary: '#FF6600', // Fire Orange
    secondary: '#CC3300', // Deep Red
    accent: '#FFDD44', // Yellow Core
  },
  vex: {
    primary: '#8844CC', // Purple
    secondary: '#442266', // Dark Purple
    accent: '#2C3E50', // Shadow
  },
  vile: {
    primary: '#4A0080', // Dark Purple
    secondary: '#1A3A1A', // Green-Black
    accent: '#00FFFF', // Soul Cyan
  },
  warrior: {
    primary: '#4682B4', // Steel Blue
    secondary: '#DAA520', // Gold
    accent: '#708090', // Iron Gray
  },
} as const;
