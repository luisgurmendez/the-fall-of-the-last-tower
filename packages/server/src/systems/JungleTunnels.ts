/**
 * JungleTunnels - Burrows through the jungle's walls (MOBAConfig.TUNNELS).
 *
 * A champion ordered to walk to a tunnel's mouth goes in when it gets
 * there: it crawls under the forest to the other mouth (a dash that passes
 * walls, dashAbilityId MOBAConfig.TUNNELS.ABILITY_ID, so clients hide it
 * and kick up dust at both mouths) and comes out CRAWL_TIME later. It can't
 * go back in for COOLDOWN after that. Any other order on the way (attack,
 * attack-move, another move, recall), or being stopped short, calls it off.
 */

import { GameEventType, Vector, type MOBAConfig } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

/** How close to a mouth the champion gets before it goes in */
const ENTER_REACH = 30;

interface Mouth {
  at: Vector;
  exit: Vector;
}

export class JungleTunnels {
  private readonly mouths: Mouth[];
  /** Champions on their way into a tunnel */
  private readonly heading = new Map<string, Mouth>();
  /** When each champion can go into a tunnel again */
  private readonly readyAt = new Map<string, number>();

  constructor(private readonly config: typeof MOBAConfig.TUNNELS) {
    this.mouths = config.LIST.flatMap(tunnel => {
      const a = new Vector(tunnel.a.x, tunnel.a.y);
      const b = new Vector(tunnel.b.x, tunnel.b.y);
      return [{ at: a, exit: b }, { at: b, exit: a }];
    });
  }

  /**
   * A champion was ordered to walk to `destination`: if it's a mouth, it
   * goes in when it gets there.
   */
  onMoveOrder(champion: ServerChampion, destination: Vector): void {
    const mouth = this.mouths.find(m => m.at.distanceTo(destination) <= this.config.ORDER_REACH);
    if (mouth) this.heading.set(champion.id, mouth);
    else this.heading.delete(champion.id);
  }

  /**
   * Champions that reached the mouth they were heading for go in.
   */
  update(context: ServerGameContext): void {
    for (const [championId, mouth] of this.heading) {
      const champion = context.getChampion(championId);
      if (!champion || champion.isDead || champion.isRecalling || champion.targetEntityId || champion.attackMoveTarget) {
        this.heading.delete(championId);
        continue;
      }
      // A dash on the way: wait for it to end
      if (champion.forcedMovement) continue;
      if (champion.position.distanceTo(mouth.at) > ENTER_REACH) {
        // Stopped short (a stop, crowd control): called off
        if (!champion.targetPosition) this.heading.delete(championId);
        continue;
      }
      this.heading.delete(championId);
      if (context.getGameTime() < (this.readyAt.get(championId) ?? 0)) continue;
      this.crawl(champion, mouth, context);
    }
  }

  private crawl(champion: ServerChampion, mouth: Mouth, context: ServerGameContext): void {
    const offset = mouth.exit.subtracted(champion.position);
    context.pathFollower.clear(champion.id);
    champion.stop();
    champion.forcedMovement = {
      direction: offset.normalized(),
      distance: offset.length(),
      duration: this.config.CRAWL_TIME,
      elapsed: 0,
      type: 'dash',
      passesWalls: true,
    };
    champion.dashAbilityId = this.config.ABILITY_ID;
    this.readyAt.set(champion.id, context.getGameTime() + this.config.CRAWL_TIME + this.config.COOLDOWN);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: this.config.ABILITY_ID,
      targetX: mouth.exit.x,
      targetY: mouth.exit.y,
    });
  }
}
