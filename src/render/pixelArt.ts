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
  // In canvas pixels (on a retina screen, twice the CSS pixels)
  const transform = ctx.getTransform();
  const drawnWidth = width * Math.hypot(transform.a, transform.b);
  ctx.imageSmoothingEnabled = drawnWidth < naturalWidth;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, width, height);
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = quality;
}

/** Smaller than this share of its box, art fills the box instead of keeping whole pixels */
const MIN_BOX_FILL = 0.85;

/**
 * Draw square pixel art centered in a square box, at the largest whole
 * number of canvas pixels per art pixel that fits, so every art pixel is
 * the same size (32px art in a 52px box on a retina screen: 3 per pixel,
 * 48px across). If that would leave it much smaller than the box, it fills
 * the box instead.
 */
export function drawPixelArtInBox(
  ctx: CanvasRenderingContext2D,
  image: PixelArtImage,
  x: number,
  y: number,
  box: number,
): void {
  const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const transform = ctx.getTransform();
  const canvasPerCss = Math.hypot(transform.a, transform.b);
  const whole = Math.floor((box * canvasPerCss) / naturalWidth);
  const fitted = (whole * naturalWidth) / canvasPerCss;
  const size = whole >= 1 && fitted >= box * MIN_BOX_FILL ? fitted : box;
  const inset = (box - size) / 2;
  drawPixelArt(ctx, image, x + inset, y + inset, size, size);
}
