/**
 * Where the bushes are, as the server has them (their hitboxes,
 * calculateIndividualBushPositions), for drawing: a unit of the local
 * team standing in one is drawn see-through, like it's hidden in the brush.
 */

import { MOBAConfig, calculateIndividualBushPositions } from '@siege/shared';

interface Rect { minX: number; minY: number; maxX: number; maxY: number }

let rects: Rect[] | null = null;

function bushRects(): Rect[] {
  if (rects) return rects;
  rects = [];
  for (let group = 0; group < MOBAConfig.BUSH_GROUPS.length; group++) {
    for (const bush of calculateIndividualBushPositions(group)) {
      rects.push({
        minX: bush.x - bush.width / 2,
        minY: bush.y - bush.height / 2,
        maxX: bush.x + bush.width / 2,
        maxY: bush.y + bush.height / 2,
      });
    }
  }
  return rects;
}

/** Whether a point is in a bush */
export function isInBrush(x: number, y: number): boolean {
  return bushRects().some((r) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY);
}
