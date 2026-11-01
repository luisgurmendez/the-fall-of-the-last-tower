/**
 * The canvas filter that flashes a unit white when it's hit: `flash` is 1
 * right after the hit (a white silhouette) and fades to 0 (as it was).
 * Lowering the contrast pulls every color toward grey, and the brightness
 * then lifts the grey to white.
 */
export function hitFlashFilter(flash: number): string {
  return `contrast(${(1 - 0.75 * flash).toFixed(3)}) brightness(${(1 + 1.6 * flash).toFixed(3)})`;
}
