/**
 * Pings and emotes in the world (the state manager's Signals): a ping is its
 * icon dropping onto the spot with rings spreading in its color; an emote
 * pops up in a bubble over its champion's head. The minimap draws pings too
 * (OnlineMinimap).
 */

import { EntityType } from '@siege/shared';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { EMOTE_DURATION, PING_DURATION, type Emote, type Ping } from '@/core/state/signals';
import { drawPixelArt } from '@/render/pixelArt';
import { emoteIcon, pingIcon, PING_STYLE } from '@/ui/signalIcons';

const PING = {
  /** World units per art pixel */
  scale: 3,
  /** The icon drops this far onto the spot, over this long (ms) */
  drop: 26,
  dropTime: 220,
  /** Rings: one every period (ms), spreading to this radius */
  ringPeriod: 900,
  ringRadius: 46,
  fadeTime: 500,
};

const EMOTE = {
  scale: 3,
  /** The bubble around the art, and how far over the head it sits */
  padding: 6,
  lift: 14,
  popTime: 200,
  fadeTime: 400,
};

/** Above the head when a champion's isn't known yet */
const DEFAULT_HEAD = -48;

/**
 * Draw the pings and the emotes over champions in sight (world space, the
 * camera's transform applied).
 */
export function renderSignals(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
  championHeads: ReadonlyMap<string, number>,
): void {
  const now = Date.now();
  const signals = stateManager.getSignals();
  for (const ping of signals.getPings(now)) drawPing(ctx, ping, now);
  for (const entity of stateManager.getEntities()) {
    if (entity.snapshot.entityType !== EntityType.CHAMPION) continue;
    const emote = signals.getEmote(entity.snapshot.entityId, now);
    if (!emote) continue;
    const head = championHeads.get(entity.snapshot.entityId) ?? DEFAULT_HEAD;
    drawEmote(ctx, emote, entity.position.x, entity.position.y + head - EMOTE.lift, now);
  }
}

function drawPing(ctx: CanvasRenderingContext2D, ping: Ping, now: number): void {
  const age = now - ping.time;
  const alpha = Math.min(1, (PING_DURATION - age) / PING.fadeTime);
  const color = PING_STYLE[ping.pingType].color;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);

  // Rings spreading from the spot, flattened onto the ground
  ctx.strokeStyle = color;
  for (let start = 0; start <= age; start += PING.ringPeriod) {
    const t = (age - start) / PING.ringPeriod;
    if (t >= 1) continue;
    ctx.globalAlpha = Math.max(0, alpha) * (1 - t);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ping.x, ping.y, PING.ringRadius * t, PING.ringRadius * t * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = Math.max(0, alpha);

  // A shadow on the spot, and the icon dropping onto it with a little bounce
  const icon = pingIcon(ping.pingType);
  const size = icon.width * PING.scale;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(ping.x, ping.y, size * 0.35, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = Math.min(1, age / PING.dropTime);
  const bounce = t < 1 ? -PING.drop * (1 - t) * (1 - t) : Math.sin(Math.min(1, (age - PING.dropTime) / 180) * Math.PI) * -4;
  drawPixelArt(ctx, icon, ping.x - size / 2, ping.y - size - 4 + bounce, size, size);
  ctx.restore();
}

function drawEmote(ctx: CanvasRenderingContext2D, emote: Emote, x: number, bottom: number, now: number): void {
  const age = now - emote.time;
  const pop = Math.min(1, age / EMOTE.popTime);
  // Overshoot, then settle
  const scale = pop < 1 ? pop * 1.2 : 1 + 0.2 * Math.max(0, 1 - (age - EMOTE.popTime) / 120);
  const alpha = Math.min(1, (EMOTE_DURATION - age) / EMOTE.fadeTime);
  const icon = emoteIcon(emote.emote);
  const size = icon.width * EMOTE.scale;
  const box = size + EMOTE.padding * 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(x, bottom);
  ctx.scale(scale, scale);
  // A speech bubble with its tail down to the head
  ctx.fillStyle = '#f4f1e8';
  ctx.strokeStyle = '#1b1325';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-box / 2, -box - 8, box, box, 8);
  ctx.moveTo(-6, -8);
  ctx.lineTo(0, 0);
  ctx.lineTo(6, -8);
  ctx.fill();
  ctx.stroke();
  // Cover the tail's join with the bubble
  ctx.fillRect(-5, -11, 10, 4);
  drawPixelArt(ctx, icon, -size / 2, -box - 8 + EMOTE.padding, size, size);
  ctx.restore();
}
