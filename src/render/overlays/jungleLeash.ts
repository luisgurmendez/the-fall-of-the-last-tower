/**
 * Jungle monsters' leash, drawn on the ground under the units. While a
 * monster fights away from its camp, a tether of moving dashes runs from
 * its spot in the camp to it: faint amber once it's half way to its leash,
 * turning red as it nears the point where it gives up and walks home. Near
 * the end, the edge of its leash shows as an arc of dashes where it's
 * heading, so a player kiting it can see how much further it will follow.
 */

import { EntityType, MOBAConfig, type JungleCreatureSnapshot } from "@siege/shared";
import type { InterpolatedEntity } from "@/core/OnlineStateManager";

/** The tether shows from this share of the leash on */
const SHOW_FROM = 0.45;
/** The leash's edge shows from this share on */
const EDGE_FROM = 0.65;
/** Half the angle the edge's arc spans (radians) */
const EDGE_HALF_ANGLE = 0.32;

const AMBER = [255, 196, 64];
const RED = [255, 64, 48];

function color(t: number, alpha: number): string {
  const [r, g, b] = AMBER.map((from, i) => Math.round(from + (RED[i] - from) * t));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw the tethers of every monster pulled far from its camp.
 */
export function renderLeashTethers(ctx: CanvasRenderingContext2D, entities: Iterable<InterpolatedEntity>, time: number): void {
  for (const entity of entities) {
    if (entity.snapshot.entityType !== EntityType.JUNGLE_CAMP) continue;
    const creature = entity.snapshot as JungleCreatureSnapshot;
    if (creature.isDead || creature.leash == null || creature.leash < SHOW_FROM || creature.homeX == null) continue;

    // 0 when it starts showing, 1 at the leash's end
    const t = Math.min(1, (creature.leash - SHOW_FROM) / (1 - SHOW_FROM));
    const { x, y } = entity.position;
    const homeX = creature.homeX;
    const homeY = creature.homeY;
    const blink = t > 0.75 ? 0.75 + 0.25 * Math.sin(time * 14) : 1;

    ctx.save();
    ctx.lineCap = "round";

    // The tether: dashes running from the monster back home
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = time * 40;
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.25 + 0.3 * t})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(homeX, homeY);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color(t, (0.35 + 0.6 * t) * blink);
    ctx.stroke();

    // Its spot in the camp
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(homeX, homeY, 12, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // The leash's edge, ahead of it
    const range = MOBAConfig.JUNGLE.CREATURE_STATS[creature.creatureType as keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS]?.leashRange;
    if (range && creature.leash >= EDGE_FROM) {
      const edge = Math.min(1, (creature.leash - EDGE_FROM) / (1 - EDGE_FROM));
      const angle = Math.atan2(y - homeY, x - homeX);
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = color(t, (0.25 + 0.65 * edge) * blink);
      ctx.beginPath();
      ctx.arc(homeX, homeY, range, angle - EDGE_HALF_ANGLE, angle + EDGE_HALF_ANGLE);
      ctx.stroke();
    }
    ctx.restore();
  }
}
