/**
 * Status marks drawn on a champion, so what it's under reads at a glance
 * (crowd control has its own marks and label: crowdControl.ts):
 * - slowed: pale blue chevrons pointing down, circling its feet;
 * - burning: small flames licking up its body;
 * - poisoned: green bubbles rising off it;
 * - bleeding: red drops falling from it;
 * - hastened: speed lines streaming back at its feet.
 *
 * Effects are sorted into marks by id (the server's effects: data/effects.ts;
 * a test checks every slowing, hastening and damage-over-time effect has its
 * mark).
 */

export type StatusMark = "slow" | "burn" | "poison" | "bleed" | "haste";

/** Effects with a mark of their own, beyond the patterns below */
const MARKS_BY_ID: Record<string, StatusMark> = {
  slow: "slow",
  vile_q_slow: "slow",
  item_frost_nova: "slow",
  summoner_hinder_slow: "slow",
  movement_speed_slow: "slow",
  burn: "burn",
  item_burn: "burn",
  summoner_scorch: "burn",
  cinders_burn: "burn",
  poison: "poison",
  elora_poison_arrow: "poison",
  elora_venom: "poison",
  zhakrul_venom: "poison",
  zhakrul_ancient_venom: "poison",
  bleed: "bleed",
  summoner_haste: "haste",
  summoner_mend_speed: "haste",
  movement_speed_buff: "haste",
  item_momentum: "haste",
  item_wanderlust: "haste",
  item_lone_wolf: "haste",
  item_unchain_speed: "haste",
  fenris_feral: "haste",
  kip_hunt_speed: "haste",
  uruk_hunt: "haste",
  vile_post_veil_speed: "haste",
  lume_guiding_glow_speed: "haste",
};

/** A status effect's mark, if it has one */
export function statusMarkOf(effectId: string): StatusMark | null {
  const own = MARKS_BY_ID[effectId];
  if (own) return own;
  if (/^slow_\d+$/.test(effectId)) return "slow";
  if (/^speed_\d+$/.test(effectId)) return "haste";
  return null;
}

/** The marks on a unit from its live effects, each once */
export function getStatusMarks(activeEffects: { definitionId: string; timeRemaining: number }[] | undefined): StatusMark[] {
  const marks = new Set<StatusMark>();
  for (const effect of activeEffects ?? []) {
    if (effect.timeRemaining <= 0) continue;
    const mark = statusMarkOf(effect.definitionId);
    if (mark) marks.add(mark);
  }
  return [...marks];
}

/**
 * Draw a champion's status marks, in its local space (origin at its center):
 * `headY` just above its head, `feetY` where it stands.
 */
export function renderStatusMarks(
  ctx: CanvasRenderingContext2D,
  marks: StatusMark[],
  headY: number,
  feetY: number,
  time: number,
): void {
  if (marks.length === 0) return;
  ctx.save();
  for (const mark of marks) {
    if (mark === "slow") drawSlow(ctx, feetY, time);
    else if (mark === "burn") drawFlames(ctx, headY, feetY, time);
    else if (mark === "poison") drawBubbles(ctx, headY, feetY, time);
    else if (mark === "bleed") drawDrops(ctx, headY, feetY, time);
    else drawSpeedLines(ctx, feetY, time);
  }
  ctx.restore();
}

/** Three chevrons pointing down, circling the feet (behind ones fainter) */
function drawSlow(ctx: CanvasRenderingContext2D, feetY: number, time: number): void {
  for (let i = 0; i < 3; i++) {
    const angle = time * 1.6 + (i * Math.PI * 2) / 3;
    const x = Math.cos(angle) * 17;
    const y = feetY - 3 + Math.sin(angle) * 5;
    const front = Math.sin(angle) > 0;
    ctx.globalAlpha = front ? 0.95 : 0.5;
    chevron(ctx, x, y, front ? 5 : 4);
  }
  ctx.globalAlpha = 1;
}

function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x - size, y - size * 0.6);
  ctx.lineTo(x, y + size * 0.5);
  ctx.lineTo(x + size, y - size * 0.6);
  ctx.lineTo(x, y - size * 0.1);
  ctx.closePath();
  ctx.fillStyle = "#8fd3ff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#1d4a6b";
  ctx.stroke();
}

/** A few flames flickering up the body, each on its own cycle */
function drawFlames(ctx: CanvasRenderingContext2D, headY: number, feetY: number, time: number): void {
  const height = feetY - headY;
  for (let i = 0; i < 4; i++) {
    const cycle = (time * 1.8 + i * 0.37) % 1;
    const x = Math.sin(i * 2.3) * 11;
    const y = feetY - height * (0.25 + 0.45 * ((i * 0.31) % 1)) - cycle * 10;
    const size = 5 * (1 - cycle) + 1.5;
    ctx.globalAlpha = 0.9 * (1 - cycle);
    flame(ctx, x, y, size, time * 20 + i);
  }
  ctx.globalAlpha = 1;
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flicker: number): void {
  const lean = Math.sin(flicker) * size * 0.25;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.6, y);
  ctx.quadraticCurveTo(x - size * 0.5, y - size, x + lean, y - size * 1.8);
  ctx.quadraticCurveTo(x + size * 0.5, y - size, x + size * 0.6, y);
  ctx.closePath();
  ctx.fillStyle = "#ff8a2a";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.3, y);
  ctx.quadraticCurveTo(x, y - size, x + lean * 0.5, y - size * 1.1);
  ctx.quadraticCurveTo(x + size * 0.3, y - size * 0.5, x + size * 0.3, y);
  ctx.closePath();
  ctx.fillStyle = "#ffe066";
  ctx.fill();
}

/** Green bubbles rising off the body and popping */
function drawBubbles(ctx: CanvasRenderingContext2D, headY: number, feetY: number, time: number): void {
  const height = feetY - headY;
  for (let i = 0; i < 4; i++) {
    const cycle = (time * 0.9 + i * 0.27) % 1;
    const x = Math.sin(i * 1.9 + cycle * 3) * 12;
    const y = feetY - height * 0.3 - cycle * height * 0.7;
    const radius = 1.5 + cycle * 2.5;
    ctx.globalAlpha = 0.85 * (1 - cycle * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(118, 230, 70, 0.8)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e4ffb8";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Red drops falling from the body */
function drawDrops(ctx: CanvasRenderingContext2D, headY: number, feetY: number, time: number): void {
  const height = feetY - headY;
  for (let i = 0; i < 3; i++) {
    const cycle = (time * 1.3 + i * 0.41) % 1;
    const x = Math.sin(i * 2.7) * 10;
    const y = headY + height * 0.45 + cycle * height * 0.5;
    ctx.globalAlpha = 0.9 * (1 - cycle * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.quadraticCurveTo(x + 2.2, y + 1, x, y + 2.2);
    ctx.quadraticCurveTo(x - 2.2, y + 1, x, y - 3);
    ctx.fillStyle = "#d32f2f";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Short white lines streaming back on both sides of the feet */
function drawSpeedLines(ctx: CanvasRenderingContext2D, feetY: number, time: number): void {
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const cycle = (time * 2.2 + i * 0.25) % 1;
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (12 + cycle * 10);
    const y = feetY - 6 - (i % 3) * 5;
    ctx.globalAlpha = 0.7 * (1 - cycle);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * 7, y);
    ctx.strokeStyle = "#e8f6ff";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
