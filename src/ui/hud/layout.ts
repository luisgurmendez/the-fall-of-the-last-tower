/**
 * Shared HUD layout: colors, panel dimensions, section sizes and the hit
 * tests used against the cached element positions.
 */

import type { HitBox, HitRect } from '@/ui/hud/types';

/** Default HUD colors */
export const HUD_COLORS = {
  background: '#1a1a2e',
  backgroundLight: '#252540',
  border: '#3a3a5c',
  borderHighlight: '#5a5a8c',
  text: '#ffffff',
  textDim: '#aaaaaa',
  healthBar: '#2ecc71',
  healthBarBg: '#1a472a',
  manaBar: '#3498db',
  manaBarBg: '#1a3a4a',
  cooldownOverlay: 'rgba(0, 0, 0, 0.7)',
  abilityReady: '#FFD700',
  abilityNotReady: '#666666',
  xpBar: '#8b5cf6',
  xpBarBg: '#2d1f3d',
  levelUpButton: '#ffd700',
  levelUpButtonHover: '#ffec8b',
};

/** Panel dimensions */
export const PANEL = {
  statsWidth: 120,
  statsHeight: 120,
  portraitSize: 90,
  passiveBoxSize: 44,
  abilitiesWidth: 240,
  abilitiesHeight: 65,
  abilityBoxSize: 52,
  abilitySpacing: 6,
  barHeight: 22,
  barSpacing: 4,
  itemsWidth: 145,
  itemsHeight: 100,
  itemBoxSize: 40,
  itemSpacing: 4,
  padding: 8,
  margin: 6,
  buffSize: 28,
  buffSpacing: 3,
  effectSize: 30,
  effectSpacing: 3,
  wardBoxSize: 40,
  tooltipWidth: 320,
  tooltipPadding: 8,
  xpBarHeight: 6,
  xpBarSpacing: 2,
  levelUpButtonWidth: 16,
  levelUpButtonHeight: 14,
  levelUpButtonGap: 2,
};

/** Check if a point is inside a box */
export function isPointInBox(
  px: number,
  py: number,
  box: HitBox
): boolean {
  return px >= box.x && px <= box.x + box.size && py >= box.y && py <= box.y + box.size;
}

/** Check if a point is inside a rectangle */
export function isPointInRect(
  px: number,
  py: number,
  rect: HitRect
): boolean {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

/** Get the items container width */
export function getItemsContainerWidth(): number {
  const innerPadding = 6;
  return 3 * PANEL.itemBoxSize + 2 * PANEL.itemSpacing + innerPadding * 2;
}

/** Get the total HUD width */
export function getTotalWidth(): number {
  return (
    PANEL.padding +
    PANEL.statsWidth +
    PANEL.margin +
    PANEL.portraitSize +
    PANEL.margin +
    PANEL.passiveBoxSize +
    PANEL.margin +
    PANEL.abilitiesWidth +
    PANEL.margin +
    getItemsContainerWidth() +
    PANEL.margin +
    PANEL.wardBoxSize +
    PANEL.padding
  );
}

/** Get the abilities section total height (abilities + bars) */
export function getAbilitiesSectionHeight(skillPoints: number, showManaBar: boolean): number {
  // Level-up buttons (if skill points available) + Abilities + health bar + mana bar (if shown)
  let height = 0;

  // Add space for level-up buttons when skill points are available
  if (skillPoints > 0) {
    height += PANEL.levelUpButtonHeight + PANEL.levelUpButtonGap;
  }

  height += PANEL.abilitiesHeight + PANEL.barSpacing + PANEL.barHeight;
  if (showManaBar) {
    height += PANEL.barSpacing + PANEL.barHeight;
  }
  return height;
}

/** Get the total HUD height */
export function getTotalHeight(skillPoints: number, showManaBar: boolean): number {
  return getAbilitiesSectionHeight(skillPoints, showManaBar) + PANEL.padding * 2;
}

/** Get the items container height */
export function getItemsContainerHeight(): number {
  const innerPadding = 6;
  return 2 * PANEL.itemBoxSize + PANEL.itemSpacing + innerPadding * 2;
}
