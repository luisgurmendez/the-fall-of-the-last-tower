/**
 * Champion portraits for champion select, the HUD, the scoreboard and the
 * minimap: the champion's face (public/assets/champs/<id>/portrait.png,
 * made with scripts/generate-portraits.ts), or without one, the first frame
 * of the champion's idle sprite cropped to the figure. A champion without
 * art (or while it loads) shows its emoji icon.
 */

/**
 * Champion icons (emoji placeholders), for champions without art.
 */
export const CHAMPION_ICONS: Record<string, string> = {
  warrior: "⚔️",
  magnus: "🔮",
  elara: "✨",
  vex: "🗡️",
  gorath: "🛡️",
  vile: "💀",
  lume: "☀️",
  uruk: "🐉",
  oitboil: "🔥",
  elora: "🏹",
  caelum: "🌿",
  fenris: "🐺",
  calamitus: "🌋",
  protobot: "🤖",
  hop: "🐰",
  zhakrul: "🦂",
  kip: "🎯",
  nocthar: "💀",
};

/** Idle sprite strips: square frames side by side, the first one is used */
const IDLE_SPRITES: Record<string, string> = {
  vex: "/assets/champs/vex/idle.png",
  lume: "/assets/champs/lume/Lume-IDLE.png",
  vile: "/assets/champs/vile/idle.png",
  warrior: "/assets/champs/warrior/idle.png",
  magnus: "/assets/champs/magnus/idle.png",
  elara: "/assets/champs/elara/idle.png",
  gorath: "/assets/champs/gorath/idle.png",
  uruk: "/assets/champs/uruk/idle.png",
  oitboil: "/assets/champs/oitboil/idle.png",
  elora: "/assets/champs/elora/idle.png",
  caelum: "/assets/champs/caelum/idle.png",
  fenris: "/assets/champs/fenris/idle.png",
  calamitus: "/assets/champs/calamitus/idle.png",
  protobot: "/assets/champs/protobot/idle.png",
  hop: "/assets/champs/hop/idle.png",
  zhakrul: "/assets/champs/zhakrul/idle.png",
  kip: "/assets/champs/kip/idle.png",
  nocthar: "/assets/champs/nocthar/idle.png",
};

/** The champion's face */
const faceOf = (championId: string) => `/assets/champs/${championId}/portrait.png`;

/** Portraits, by champion, drawn once */
const portraits = new Map<string, Promise<HTMLCanvasElement | null>>();
/** The ones that have loaded */
const loadedPortraits = new Map<string, HTMLCanvasElement | null>();

function getPortrait(championId: string): Promise<HTMLCanvasElement | null> {
  let portrait = portraits.get(championId);
  if (!portrait) {
    const sprite = IDLE_SPRITES[championId];
    portrait = loadImage(faceOf(championId)).then(async (face) => {
      if (face) return toCanvas(face);
      const strip = sprite ? await loadImage(sprite) : null;
      return strip ? cropFirstFrame(strip) : null;
    });
    portraits.set(championId, portrait);
    void portrait.then((canvas) => loadedPortraits.set(championId, canvas));
  }
  return portrait;
}

/**
 * A champion's portrait for drawing on a canvas, once it has loaded (the
 * first call starts loading it); null until then or without art.
 */
export function getPortraitCanvas(championId: string): HTMLCanvasElement | null {
  if (!IDLE_SPRITES[championId]) return null;
  void getPortrait(championId);
  return loadedPortraits.get(championId) ?? null;
}

/**
 * Show a champion's portrait in `el`, replacing what it held.
 */
export function showPortrait(el: HTMLElement, championId: string): void {
  el.textContent = CHAMPION_ICONS[championId] || "❓";
  el.dataset.portraitFor = championId;
  if (!IDLE_SPRITES[championId]) return;

  void getPortrait(championId).then((canvas) => {
    // Another champion may have been picked while it loaded
    if (!canvas || el.dataset.portraitFor !== championId) return;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")?.drawImage(canvas, 0, 0);
    copy.className = "champion-portrait-art";
    el.textContent = "";
    el.appendChild(copy);
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function toCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas;
}

/**
 * The first frame, cropped to a square around the figure.
 */
function cropFirstFrame(image: HTMLImageElement): HTMLCanvasElement | null {
  const size = image.naturalHeight;
  const frame = document.createElement("canvas");
  frame.width = size;
  frame.height = size;
  const context = frame.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size, 0, 0, size, size);

  const alpha = context.getImageData(0, 0, size, size).data;
  let left = size, top = size, right = -1, bottom = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (alpha[(y * size + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;

  const side = Math.max(right - left, bottom - top) + 1;
  const cropped = document.createElement("canvas");
  cropped.width = side;
  cropped.height = side;
  const centerX = (left + right + 1) / 2;
  const centerY = (top + bottom + 1) / 2;
  cropped.getContext("2d")?.drawImage(frame, Math.round(side / 2 - centerX), Math.round(side / 2 - centerY));
  return cropped;
}
