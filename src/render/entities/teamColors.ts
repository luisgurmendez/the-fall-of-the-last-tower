/**
 * Red-team versions of art drawn in the blue team's colors (the generated
 * minions): strongly blue pixels turn red, the rest (steel, skin, wood)
 * stays. Each variant is made once, as an image with a data URL, so it
 * works wherever an image does (outlines are cached by src).
 */

/** Blue hues (degrees) that are the team color, and how far to turn them to land on red */
const BLUE_HUES = { from: 185, to: 265 };
const HUE_SHIFT = 140;
/** Greyish blues (steel, shadows) keep their color */
const MIN_SATURATION = 0.35;
const MIN_VALUE = 0.15;

const redVariants = new Map<string, HTMLImageElement | null>();

/**
 * The red team's version of a blue-team image, once it's ready (null
 * until then, or if it can't be made).
 */
export function getRedVariant(image: HTMLImageElement): HTMLImageElement | null {
  let variant = redVariants.get(image.src);
  if (variant === undefined) {
    variant = createRedVariant(image);
    redVariants.set(image.src, variant);
  }
  return variant && variant.complete && variant.naturalWidth > 0 ? variant : null;
}

function createRedVariant(image: HTMLImageElement): HTMLImageElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (h < BLUE_HUES.from || h > BLUE_HUES.to || s < MIN_SATURATION || v < MIN_VALUE) continue;
    const [r, g, b] = hsvToRgb((h + HUE_SHIFT) % 360, s, v);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  context.putImageData(pixels, 0, 0);
  const variant = new Image();
  variant.src = canvas.toDataURL();
  return variant;
}

/** Hue in degrees, saturation and value 0-1 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : delta / max, max / 255];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
