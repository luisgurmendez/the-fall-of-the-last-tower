/**
 * ServerBlossom - A healing blossom on a map's lane (map config BLOSSOMS;
 * The Narrows has them).
 *
 * It first blooms FIRST_BLOOM seconds into the match. The first living
 * champion of either side to come within RADIUS of it in bloom regains
 * HEAL of its max health and resource, and it regrows REGROW seconds
 * later. It's neutral and can't be hit: units walk through it and nothing
 * targets it. Clients see it from anywhere, with its regrowth timer, and
 * the pick is an ABILITY_CAST `blossom_heal` on the champion (for the VFX
 * and the sound).
 */

import { EntityType, GameEventType, type BlossomSnapshot, type DamageType, type MOBAConfig } from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

export const BLOSSOM_HEAL_EVENT_ID = 'blossom_heal';

export class ServerBlossom extends ServerEntity {
  /** When it blooms again; null while it's in bloom */
  private regrowsAt: number | null;

  constructor(config: Omit<ServerEntityConfig, 'entityType' | 'side'>, private readonly settings: typeof MOBAConfig.BLOSSOMS) {
    super({ ...config, entityType: EntityType.BLOSSOM, side: 2 });
    this.regrowsAt = settings.FIRST_BLOOM;
  }

  override isCollidable(): boolean {
    return false;
  }

  override getRadius(): number {
    return this.settings.RADIUS;
  }

  /** Nothing hurts it */
  override takeDamage(_amount: number, _type: DamageType, _sourceId?: string, _context?: ServerGameContext): number {
    return 0;
  }

  update(_dt: number, context: ServerGameContext): void {
    const now = context.getGameTime();
    if (this.regrowsAt !== null) {
      if (now < this.regrowsAt) return;
      this.regrowsAt = null;
    }

    const champion = context.getAllChampions().find(c => !c.isDead && c.position.distanceTo(this.position) <= this.settings.RADIUS);
    if (!champion) return;

    champion.heal(champion.maxHealth * this.settings.HEAL, context, this.id);
    champion.resource = Math.min(champion.maxResource, champion.resource + champion.maxResource * this.settings.HEAL);
    this.regrowsAt = now + this.settings.REGROW;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: BLOSSOM_HEAL_EVENT_ID,
      targetX: this.position.x,
      targetY: this.position.y,
    });
  }

  toSnapshot(): BlossomSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.BLOSSOM,
      side: this.side,
      x: this.position.x,
      y: this.position.y,
      regrowsAt: this.regrowsAt,
    };
  }
}
