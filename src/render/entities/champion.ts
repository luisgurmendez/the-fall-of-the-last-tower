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
import {
  TEAM_COLORS,
  lightenColor,
  drawGroundShadow,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
  renderResourceBar,
} from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";
import { getCrowdControl, renderCrowdControl } from "@/render/overlays/crowdControl";
import { renderMarkIndicators } from "@/render/overlays/statusIndicators";
import {
  createChampionBodyRenderers,
  type ChampionBodyRenderer,
} from "@/render/champions";

/** Champion health bars get a tick every this much health */
const CHAMPION_HEALTH_TICK = 100;

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
   * Jungle buffs on the ground under the champion, so everyone can see who
   * holds them: a blue ring with orbiting sparks for Crest of Insight, a
   * flickering red-orange ring with rising embers for Crest of Cinders.
   */
  private renderJungleBuffAuras(
    ctx: CanvasRenderingContext2D,
    activeEffects: Array<{ definitionId: string }> | undefined,
  ): void {
    if (!activeEffects) return;
    const hasInsight = activeEffects.some((effect) => effect.definitionId === "crest_of_insight");
    const hasCinders = activeEffects.some((effect) => effect.definitionId === "crest_of_cinders");
    if (!hasInsight && !hasCinders) return;

    const time = this.rc.animationTime;
    const auras: Array<{ color: string; radius: number; speed: number }> = [];
    if (hasInsight) auras.push({ color: "79, 195, 247", radius: 32, speed: 1.6 });
    if (hasCinders) auras.push({ color: "255, 112, 67", radius: hasInsight ? 40 : 32, speed: -2.2 });

    for (const aura of auras) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + aura.radius);

      ctx.save();
      ctx.translate(0, 14);
      ctx.scale(1, 0.45);
      ctx.fillStyle = `rgba(${aura.color}, 0.12)`;
      ctx.beginPath();
      ctx.arc(0, 0, aura.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${aura.color}, ${0.6 + pulse * 0.3})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, aura.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Three sparks running around the ring
      ctx.fillStyle = `rgba(${aura.color}, 0.9)`;
      for (let i = 0; i < 3; i++) {
        const angle = time * aura.speed + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * aura.radius, Math.sin(angle) * aura.radius, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Embers drifting up from the red buff
    if (hasCinders) {
      for (let i = 0; i < 5; i++) {
        const phase = (time * 0.7 + i / 5) % 1;
        const x = Math.sin(i * 2.4 + time * 2) * 20;
        const y = 12 - phase * 46;
        ctx.fillStyle = `rgba(255, ${150 + Math.round(phase * 80)}, 64, ${0.9 * (1 - phase)})`;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }

  /**
   * Item passive states (marker effects from ChampionItemPassives): stars
   * circling a champion whose next attack Starfall charged, and a steel
   * dome over one Hold the Line is shielding.
   */
  private renderItemPassiveAuras(
    ctx: CanvasRenderingContext2D,
    activeEffects: Array<{ definitionId: string }> | undefined,
  ): void {
    if (!activeEffects) return;
    const time = this.rc.animationTime;

    if (activeEffects.some((effect) => effect.definitionId === "item_starfall")) {
      for (let i = 0; i < 3; i++) {
        const angle = time * 3 + (i * Math.PI * 2) / 3;
        const x = Math.cos(angle) * 22;
        const y = -6 + Math.sin(angle) * 8;
        // Behind the champion when on the far side of the circle
        const glow = Math.sin(angle) > 0 ? 1 : 0.55;
        this.drawStar(ctx, x, y, 5, `rgba(255, 224, 130, ${glow})`);
        ctx.fillStyle = `rgba(195, 155, 255, ${0.35 * glow})`;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (activeEffects.some((effect) => effect.definitionId === "item_hold_the_line")) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.save();
      ctx.strokeStyle = `rgba(208, 214, 224, ${0.45 + pulse * 0.35})`;
      ctx.fillStyle = "rgba(208, 214, 224, 0.08)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -6, 30, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * A four-pointed star centered on (x, y).
   */
  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.3, y - size * 0.3);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.3, y + size * 0.3);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.3, y + size * 0.3);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.3, y - size * 0.3);
    ctx.closePath();
    ctx.fill();
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
    this.renderJungleBuffAuras(ctx, snapshot.activeEffects);

    // Check if this champion has sprite support
    let renderedWithSprite = false;

    const body = this.bodies.get(championId);
    const feet = body?.getFeet?.();
    if (feet) drawGroundShadow(ctx, feet.y, feet.halfWidth);

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

    this.renderItemPassiveAuras(ctx, snapshot.activeEffects);

    // Stunned, rooted, silenced...: shown on the champion with what it is and the time left
    renderCrowdControl(
      ctx,
      getCrowdControl(snapshot.activeEffects),
      healthBarYOffset + HEALTH_BAR_PADDING,
      feet?.y ?? -healthBarYOffset - HEALTH_BAR_PADDING,
      this.rc.animationTime,
    );

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
        {
          trailHealth: getTrailHealth(snapshot.entityId, snapshot.health),
          tickEvery: CHAMPION_HEALTH_TICK,
        },
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
