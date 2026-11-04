/**
 * How champion select's grid wraps: rows of at most CHAMPIONS_PER_ROW
 * cards, as even as they can be (17 champions are rows of 9 and 8). The
 * grid gets the count as its --columns (championSelect.ts), and CSS keeps
 * it that wide.
 */

export const CHAMPIONS_PER_ROW = 10;

/** Cards per row for `count` champions */
export function championGridColumns(count: number): number {
  if (count <= 0) return 1;
  const rows = Math.ceil(count / CHAMPIONS_PER_ROW);
  return Math.ceil(count / rows);
}
