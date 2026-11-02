/**
 * Drawing for the debug overlay (DebugOverlay): what the server thinks about
 * a unit, drawn in world space over it. Line widths and text keep their size
 * on screen at any zoom.
 */

import { EntityType, getChampionDefinition, type DebugUnit, type EntitySnapshot } from "@siege/shared";
import type Vector from "@/physics/vector";

/** The layers the panel turns on and off */
export interface DebugLayers {
  paths: boolean;
  targets: boolean;
  hitboxes: boolean;
  ranges: boolean;
  sight: boolean;
  leashes: boolean;
  labels: boolean;
  abilities: boolean;
}

export const DEFAULT_LAYERS: DebugLayers = {
  paths: true,
  targets: true,
  hitboxes: true,
  ranges: true,
  sight: false,
  leashes: true,
  labels: true,
  abilities: true,
};

const SIDE_COLORS = ["#4da3ff", "#ff5a5a", "#ffd34d"];
const TARGET_COLOR = "#ff9f1a";
const LEASH_COLOR = "#ffd34d";
const ABILITY_COLOR = "#c38bff";

export function sideColor(side: number): string {
  return SIDE_COLORS[side] ?? SIDE_COLORS[2];
}

/** An entity ID without the match's prefix ("game-1793..._e41" -> "e41") */
export function shortId(entityId: string): string {
  return entityId.slice(entityId.lastIndexOf("_") + 1);
}

/** A unit's name for the panel and labels: its champion, minion type, tower or monster */
export function unitName(snapshot: EntitySnapshot | undefined): string {
  if (!snapshot) return "unknown";
  switch (snapshot.entityType) {
    case EntityType.CHAMPION:
      return getChampionDefinition(snapshot.championId)?.name ?? snapshot.championId;
    case EntityType.MINION:
      return `${snapshot.minionType} minion`;
    case EntityType.TOWER:
      return `${snapshot.lane} tower ${snapshot.tier}`;
    case EntityType.JUNGLE_CAMP:
      return snapshot.creatureType;
    default:
      return snapshot.entityId;
  }
}

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Camera zoom: world units to screen pixels */
  zoom: number;
  layers: DebugLayers;
  /** Where an entity is drawn, if the client knows it */
  positionOf: (entityId: string) => Vector | undefined;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
  ctx.stroke();
}

/** Text with a dark outline, a fixed size on screen */
function label(dc: DrawContext, text: string, x: number, y: number, color: string, size = 12): void {
  const { ctx, zoom } = dc;
  ctx.font = `${size / zoom}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 3 / zoom;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * One unit: its leash, sight and attack range, hitbox, path, a line to its
 * target, its abilities' reach (only when `selected`) and its state.
 */
export function drawUnit(dc: DrawContext, unit: DebugUnit, snapshot: EntitySnapshot, position: Vector, selected: boolean): void {
  const { ctx, zoom, layers } = dc;
  const color = sideColor(snapshot.side);
  const px = 1 / zoom;
  ctx.save();

  if (layers.leashes && unit.leash) {
    ctx.strokeStyle = LEASH_COLOR;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([6 * px, 6 * px]);
    circle(ctx, unit.leash.x, unit.leash.y, unit.leash.radius);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(unit.leash.x, unit.leash.y);
    ctx.lineTo(position.x, position.y);
    ctx.stroke();
  }

  if (layers.sight && unit.sight) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1 * px;
    circle(ctx, position.x, position.y, unit.sight);
  }

  if (layers.ranges && unit.attackRange) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([4 * px, 4 * px]);
    // Edge to edge: a target is in range once its edge crosses this ring
    circle(ctx, position.x, position.y, unit.radius + unit.attackRange);
    ctx.setLineDash([]);
  }

  if (layers.hitboxes) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.5 * px;
    circle(ctx, position.x, position.y, unit.radius);
  }

  if (layers.paths && unit.path && unit.path.length > 0) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    for (const point of unit.path) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    for (const point of unit.path) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    // An X where it ends
    const end = unit.path[unit.path.length - 1];
    const s = 6 * px;
    ctx.beginPath();
    ctx.moveTo(end.x - s, end.y - s);
    ctx.lineTo(end.x + s, end.y + s);
    ctx.moveTo(end.x + s, end.y - s);
    ctx.lineTo(end.x - s, end.y + s);
    ctx.stroke();
  }

  const target = unit.targetId ? dc.positionOf(unit.targetId) : undefined;
  if (layers.targets && target) {
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      const ux = dx / length;
      const uy = dy / length;
      const tip = { x: target.x - ux * 10 * px, y: target.y - uy * 10 * px };
      ctx.strokeStyle = TARGET_COLOR;
      ctx.fillStyle = TARGET_COLOR;
      // Minions' arrows fainter: a fight has a lot of them
      ctx.globalAlpha = snapshot.entityType === EntityType.MINION ? 0.45 : 0.9;
      ctx.lineWidth = (snapshot.entityType === EntityType.TOWER ? 3 : 2) * px;
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      const head = 8 * px;
      ctx.beginPath();
      ctx.moveTo(tip.x + ux * head, tip.y + uy * head);
      ctx.lineTo(tip.x - uy * head * 0.6, tip.y + ux * head * 0.6);
      ctx.lineTo(tip.x + uy * head * 0.6, tip.y - ux * head * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (selected && layers.abilities && unit.abilities) {
    ctx.globalAlpha = 0.7;
    for (const ability of unit.abilities) {
      // Set every time: the label below changes them
      ctx.strokeStyle = ABILITY_COLOR;
      ctx.lineWidth = 1.5 * px;
      circle(ctx, position.x, position.y, ability.range);
      label(dc, `${ability.slot} ${ability.range}`, position.x, position.y - ability.range - 14 * px, ABILITY_COLOR, 11);
    }
  }

  if (layers.labels) {
    ctx.globalAlpha = 1;
    label(dc, unit.state, position.x, position.y + unit.radius + 4 * px, selected ? "#ffffff" : "#e6e6f0");
  }

  ctx.restore();
}
