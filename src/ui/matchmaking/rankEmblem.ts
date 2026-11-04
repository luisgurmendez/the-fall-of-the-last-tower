/**
 * A rank's emblem: a pixel-art crest per tier, grander tier by tier
 * (PixelLab, scripts/generate-props.ts → public/assets/ranks/<tier>.png,
 * 64px, drawn with its pixels scaled up). Before the first rated match, the
 * unranked one. Without the art, a badge in the tier's color.
 */

/** The emblem's art for a tier (null: unranked) */
export function rankEmblemUrl(tier: string | null): string {
  return `/assets/ranks/${tier ?? "unranked"}.png`;
}

/** An emblem `size` CSS pixels across */
export function rankEmblem(tier: string | null, size: number): HTMLElement {
  const emblem = document.createElement("div");
  emblem.className = `rank-emblem tier-${tier ?? "unranked"}`;
  emblem.style.width = emblem.style.height = `${size}px`;
  const image = document.createElement("img");
  image.src = rankEmblemUrl(tier);
  image.alt = "";
  image.draggable = false;
  image.onerror = () => {
    image.remove();
    emblem.classList.add("missing");
  };
  emblem.append(image);
  return emblem;
}
