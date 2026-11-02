/**
 * Crowd control drawn on the champion it holds, so it's clear why it can't
 * act: a golden shell (in stasis, by its own hourglass), stars circling its
 * head (stunned, suppressed, airborne), roots
 * around its feet (rooted), a crossed-out speech bubble (silenced), a red
 * "!" (taunted), a dark cloud (blinded), and under its feet a label with
 * what it is and a bar of the time left.
 */

/** Kinds of crowd control, strongest first (the label shows the strongest) */
const KINDS = ["stasis", "suppress", "stun", "knockup", "taunt", "root", "silence", "blind", "disarm", "grounded"] as const;
export type CrowdControlKind = typeof KINDS[number];

/** Effects that are crowd control, by effect id (server data/effects.ts) */
const CC_EFFECTS: Record<string, CrowdControlKind> = {
  stun: "stun",
  suppress: "suppress",
  knockup: "knockup",
  taunt: "taunt",
  root: "root",
  vile_root: "root",
  silence: "silence",
  blind: "blind",
  disarm: "disarm",
  grounded: "grounded",
  item_stasis: "stasis",
};

const LABELS: Record<CrowdControlKind, string> = {
  stasis: "STASIS",
  suppress: "SUPPRESSED",
  stun: "STUNNED",
  knockup: "AIRBORNE",
  taunt: "TAUNTED",
  root: "ROOTED",
  silence: "SILENCED",
  blind: "BLINDED",
  disarm: "DISARMED",
  grounded: "GROUNDED",
};

const COLORS: Record<CrowdControlKind, string> = {
  stasis: "#ffd54f",
  suppress: "#c084fc",
  stun: "#ffd54f",
  knockup: "#ffd54f",
  taunt: "#ff5252",
  root: "#7bd88f",
  silence: "#90caf9",
  blind: "#b0bec5",
  disarm: "#ffab91",
  grounded: "#bcaaa4",
};

/** Vile's roots are his own violet */
const EFFECT_COLORS: Record<string, string> = {
  vile_root: "#c084fc",
};

interface ActiveEffect {
  definitionId: string;
  timeRemaining: number;
  totalDuration?: number;
}

interface ActiveCrowdControl {
  kind: CrowdControlKind;
  color: string;
  timeRemaining: number;
  totalDuration: number;
}

/**
 * The crowd control on a unit, strongest first.
 */
export function getCrowdControl(activeEffects: ActiveEffect[] | undefined): ActiveCrowdControl[] {
  if (!activeEffects) return [];
  const active: ActiveCrowdControl[] = [];
  for (const effect of activeEffects) {
    const kind = CC_EFFECTS[effect.definitionId];
    if (!kind || effect.timeRemaining <= 0) continue;
    active.push({
      kind,
      color: EFFECT_COLORS[effect.definitionId] ?? COLORS[kind],
      timeRemaining: effect.timeRemaining,
      totalDuration: Math.max(effect.totalDuration ?? effect.timeRemaining, effect.timeRemaining),
    });
  }
  return active.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

/**
 * Draw a champion's crowd control, in its local space (origin at its
 * center): `headY` is just above its head, `feetY` where it stands.
 */
export function renderCrowdControl(
  ctx: CanvasRenderingContext2D,
  crowdControl: ActiveCrowdControl[],
  headY: number,
  feetY: number,
  time: number,
): void {
  if (crowdControl.length === 0) return;
  const kinds = new Set(crowdControl.map((cc) => cc.kind));

  ctx.save();
  if (kinds.has("stasis")) drawStasis(ctx, headY, feetY, time);
  if (kinds.has("stun") || kinds.has("suppress") || kinds.has("knockup")) {
    const cc = crowdControl.find((c) => c.kind === "stun" || c.kind === "suppress" || c.kind === "knockup")!;
    drawCirclingStars(ctx, headY, time, cc.color);
  }
  if (kinds.has("root")) {
    drawRoots(ctx, feetY, time, crowdControl.find((c) => c.kind === "root")!.color);
  }
  if (kinds.has("silence")) drawSilence(ctx, headY);
  if (kinds.has("taunt")) drawTaunt(ctx, headY, time);
  if (kinds.has("blind")) drawBlind(ctx, headY, time);

  drawLabel(ctx, crowdControl[0], feetY);
  ctx.restore();
}

/** A golden shell over the whole champion, shimmering */
function drawStasis(ctx: CanvasRenderingContext2D, headY: number, feetY: number, time: number): void {
  const centerY = (headY + feetY) / 2;
  const height = feetY - headY + 16;
  const shimmer = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.fillStyle = `rgba(255, 213, 79, ${0.28 + 0.1 * shimmer})`;
  ctx.strokeStyle = `rgba(255, 236, 179, ${0.7 + 0.3 * shimmer})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, centerY, 26, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawCirclingStars(ctx: CanvasRenderingContext2D, headY: number, time: number, color: string): void {
  for (let i = 0; i < 3; i++) {
    const angle = time * 5 + (i * Math.PI * 2) / 3;
    const x = Math.cos(angle) * 15;
    const y = headY + 8 + Math.sin(angle) * 5;
    // Bigger on the near side of the circle
    drawStar(ctx, x, y, Math.sin(angle) > 0 ? 6 : 4.5, color);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Vines curling up around the legs, swaying a little */
function drawRoots(ctx: CanvasRenderingContext2D, feetY: number, time: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, feetY, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const baseX = -12 + i * 6;
    const sway = Math.sin(time * 3 + i) * 2;
    const height = 12 + (i % 2) * 6;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(baseX, feetY);
    ctx.quadraticCurveTo(baseX + (i < 2 ? 7 : -7) + sway, feetY - height * 0.6, baseX * 0.4 + sway, feetY - height);
    ctx.stroke();
  }
}

/** A speech bubble with "..." crossed out */
function drawSilence(ctx: CanvasRenderingContext2D, headY: number): void {
  const y = headY - 10;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(14, y, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#333";
  for (let i = -1; i <= 1; i++) ctx.fillRect(14 + i * 3.5 - 1, y - 1, 2, 2);
  ctx.strokeStyle = "#e53935";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, y + 6);
  ctx.lineTo(22, y - 6);
  ctx.stroke();
}

function drawTaunt(ctx: CanvasRenderingContext2D, headY: number, time: number): void {
  const bob = Math.sin(time * 8) * 1.5;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000";
  ctx.strokeText("!", 0, headY - 4 + bob);
  ctx.fillStyle = COLORS.taunt;
  ctx.fillText("!", 0, headY - 4 + bob);
}

/** A dark cloud over the eyes */
function drawBlind(ctx: CanvasRenderingContext2D, headY: number, time: number): void {
  ctx.fillStyle = "rgba(40, 40, 50, 0.75)";
  for (let i = 0; i < 4; i++) {
    const x = -9 + i * 6 + Math.sin(time * 2 + i) * 1.5;
    ctx.beginPath();
    ctx.arc(x, headY + 8, 5 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** "ROOTED" under the feet, over a bar of the time left */
function drawLabel(ctx: CanvasRenderingContext2D, cc: ActiveCrowdControl, feetY: number): void {
  const y = feetY + 10;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.strokeText(LABELS[cc.kind], 0, y);
  ctx.fillStyle = cc.color;
  ctx.fillText(LABELS[cc.kind], 0, y);

  const width = 34;
  const fraction = Math.max(0, Math.min(1, cc.timeRemaining / cc.totalDuration));
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(-width / 2 - 1, y + 6, width + 2, 4);
  ctx.fillStyle = cc.color;
  ctx.fillRect(-width / 2, y + 7, width * fraction, 2);
}
