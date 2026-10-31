/**
 * Drawing pixel art at a size other than its own. Enlarged, each art pixel
 * stays a crisp block. Shrunk, nearest-neighbor would drop whole rows and
 * columns of pixels (thin lines break, details turn to noise), so it's
 * filtered instead, averaging the pixels it merges.
 */

type PixelArtImage = HTMLImageElement | HTMLCanvasElement;

export function drawPixelArt(
  ctx: CanvasRenderingContext2D,
  image: PixelArtImage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const smoothing = ctx.imageSmoothingEnabled;
  const quality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = width < naturalWidth;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, width, height);
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = quality;
}
