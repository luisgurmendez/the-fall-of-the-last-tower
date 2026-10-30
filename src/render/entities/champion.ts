/**
 * Champion renderer: the body (a champion-specific sprite, or the default
 * circle), health and resource bars, status icons and the local player's
 * level. Champion-specific drawing lives in src/render/champions/.
 */

import {
  GameConfig,
  getChampionDefinition,
  isRectangleCollision,
  isCircleCollision,
} from "@siege/shared";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { TEAM_COLORS, lightenColor } from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
  renderResourceBar,
} from "@/render/overlays/healthBars";
import { renderMarkIndicators } from "@/render/overlays/statusIndicators";
import {
  createChampionBodyRenderers,
  type ChampionBodyRenderer,
} from "@/render/champions";

/**
 * Renders champions. Holds the champion body renderers, which can keep
 * state between frames, so EntityRenderer keeps one instance per match.
 */
export class ChampionRenderer {
  private rc: EntityRenderContext;

  // Body renderers of the champions that have one, keyed by championId
  private bodies: Map<string, ChampionBodyRenderer>;

  constructor(rc: EntityRenderContext) {
    this.rc = rc;
    this.bodies = createChampionBodyRenderers(rc);
  }

  /**
   * Recall channel: a ring on the ground that fills over the recall duration,
   * with motes of light rising around the champion.
   */
  private renderRecallChannel(ctx: CanvasRenderingContext2D, progressSeconds: number): void {
    const progress = Math.min(1, progressSeconds / GameConfig.TIMING.RECALL_DURATION);
    const time = this.rc.animationTime;
    const radius = 34;

    ctx.save();
    ctx.translate(0, 14);
    ctx.scale(1, 0.45);

    ctx.fillStyle = "rgba(79, 195, 247, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(79, 195, 247, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#81d4fa";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Rising motes, denser as the recall nears completion
    const motes = 6 + Math.floor(progress * 10);
    for (let i = 0; i < motes; i++) {
      const phase = (time * 0.8 + i / motes) % 1;
      const angle = (i / motes) * Math.PI * 2 + time;
      const x = Math.cos(angle) * radius * 0.8;
      const y = 14 + Math.sin(angle) * radius * 0.35 - phase * 70;
      ctx.fillStyle = `rgba(179, 229, 252, ${0.9 * (1 - phase)})`;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }

  /**
   * Render a champion.
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    side: number,
    isLocalPlayer: boolean,
    state: EntityRenderState,
  ): void {
    const size = 40;
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;

    // Calculate health bar position based on visual height or collision shape
    const HEALTH_BAR_PADDING = 8; // Padding above visual bounds
    let healthBarYOffset = -size * 0.7; // Default fallback

    const championId = snapshot.championId;
    if (championId) {
      const definition = getChampionDefinition(championId);
      if (definition) {
        // Use visualHeight if defined, otherwise derive from collision
        if (definition.visualHeight !== undefined) {
          // Visual height is centered, so top is at -visualHeight/2
          healthBarYOffset = -definition.visualHeight / 2 - HEALTH_BAR_PADDING;
        } else if (definition.collision) {
          const collision = definition.collision;
          const offsetY = collision.offset?.y ?? 0;
          if (isRectangleCollision(collision)) {
            healthBarYOffset =
              offsetY - collision.height / 2 - HEALTH_BAR_PADDING;
          } else if (isCircleCollision(collision)) {
            healthBarYOffset = offsetY - collision.radius - HEALTH_BAR_PADDING;
          }
        }
      }
    }

    if (snapshot.isRecalling) {
      this.renderRecallChannel(ctx, snapshot.recallProgress ?? 0);
    }

    // Check if this champion has sprite support
    let renderedWithSprite = false;

    const body = this.bodies.get(championId);
    if (body) {
      renderedWithSprite = body.render(ctx, snapshot, state);
    }

    // Fallback: Draw body as circle with gradient if no sprite
    if (!renderedWithSprite) {
      const gradient = ctx.createRadialGradient(
        0,
        -size * 0.2,
        0,
        0,
        0,
        size * 0.5,
      );
      gradient.addColorStop(0, lightenColor(color, 30));
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isLocalPlayer ? "#ffffff" : "#333333";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw health bar with shields (positioned based on collision shape)
    const healthBarY = healthBarYOffset;
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      // Determine health bar color based on relationship to local player
      // Green for self, blue for ally, red for enemy
      let healthBarColor: string;
      if (isLocalPlayer) {
        healthBarColor = HEALTH_BAR_COLORS.SELF; // Green
      } else if (side === this.rc.localSide) {
        healthBarColor = HEALTH_BAR_COLORS.ALLY; // Blue
      } else {
        healthBarColor = HEALTH_BAR_COLORS.ENEMY; // Red
      }

      // Extract shields from snapshot (if available)
      const shields = snapshot.shields as
        | Array<{ amount: number; shieldType: string }>
        | undefined;
      renderHealthBar(
        ctx,
        snapshot.health,
        snapshot.maxHealth,
        size,
        healthBarY,
        healthBarColor,
        shields,
      );
    }

    // Draw mark indicators above health bar (debuffs on enemies, buffs on self)
    const isEnemy = side !== this.rc.localSide;
    const activeEffects = snapshot.activeEffects as
      | Array<{
          definitionId: string;
          timeRemaining: number;
          totalDuration?: number;
          stacks: number;
        }>
      | undefined;
    renderMarkIndicators(
      ctx,
      activeEffects,
      size,
      healthBarY,
      isLocalPlayer,
      isEnemy,
    );

    // Draw mana bar for local player (below health bar)
    if (
      isLocalPlayer &&
      snapshot.resource !== undefined &&
      snapshot.maxResource !== undefined
    ) {
      renderResourceBar(
        ctx,
        snapshot.resource,
        snapshot.maxResource,
        size,
        healthBarY + 8, // Position below health bar
      );
    }

    // Draw level indicator to the left of health bar (only for local player)
    if (isLocalPlayer && snapshot.level !== undefined) {
      const levelX = -size / 2 - 8; // Left of health bar
      const levelY = healthBarY + 3; // Aligned with health bar center
      const levelText = snapshot.level.toString();

      // Draw level number with black outline (like damage numbers)
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Black outline
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(levelText, levelX, levelY);

      // White fill
      ctx.fillStyle = "#ffffff";
      ctx.fillText(levelText, levelX, levelY);
    }
  }
}
