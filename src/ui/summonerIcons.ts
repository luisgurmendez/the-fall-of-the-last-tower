/**
 * Summoner spell icons (scripts/generate-props.ts, public/assets/summoners/),
 * loaded once and shared by the HUD, champion select and the loading screen.
 */

const icons = new Map<string, HTMLImageElement>();

/** Where a summoner spell's icon is served */
export function summonerIconUrl(id: string): string {
  return `/assets/summoners/${id}.png`;
}

/**
 * A summoner spell's icon for drawing on a canvas, once it has loaded (the
 * first call starts loading it); null until then.
 */
export function getSummonerIcon(id: string): HTMLImageElement | null {
  let image = icons.get(id);
  if (!image) {
    image = new Image();
    image.src = summonerIconUrl(id);
    icons.set(id, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}
