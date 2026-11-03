/**
 * Hop-To-Eat's rules beyond its abilities' generic execution:
 * - Hop to It! (passive): every few seconds its basic attack reaches much
 *   further: an attack that starts out of its melee reach hops onto the
 *   target first (a dash timed to land before the blow), and the attack
 *   deals bonus physical damage, as part of the basic attack (for items:
 *   Veil doesn't block it). The passive's cooldown is the time to the next
 *   hop; an ABILITY_CAST hop_hop marks each hop for the VFX. Rooted or
 *   grounded it can't hop: its reach stays melee and the hop waits
 * - Bunny Hop (E): readies the next hop at once
 */

import { GameEventType, HOP_HOP } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';

interface HopState {
  /** The target of the attack that hopped, until its blow lands (or the next attack starts) */
  hopTarget?: string;
}

function hopOf(champion: ServerChampion): HopState {
  return (champion.passiveState.customData ??= {}) as HopState;
}

const hopReady = (champion: ServerChampion) => champion.passiveState.cooldownRemaining <= 0;
/** The hop is ready and it can hop (rooted or grounded, it waits) */
const canHop = (champion: ServerChampion) =>
  hopReady(champion) && champion.ccStatus.canMove && !champion.ccStatus.isGrounded;

export const hopHooks: IChampionHooks = {
  championId: 'hop',

  getAttackRange(champion: ServerChampion, range: number): number {
    return canHop(champion) ? Math.max(range, HOP_HOP.reach) : range;
  },

  onBasicAttackStart(champion: ServerChampion, target: ServerEntity, context: ServerGameContext): void {
    // Each attack is a hop or not: one whose blow never landed leaves nothing for the next
    const hop = hopOf(champion);
    hop.hopTarget = undefined;
    if (!canHop(champion)) return;
    champion.passiveState.cooldownRemaining = HOP_HOP.every;
    hop.hopTarget = target.id;

    const toTarget = target.position.subtracted(champion.position);
    const gap = toTarget.length() - champion.getRadius() - target.getRadius() - champion.definition.baseStats.attackRange * 0.6;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'hop_hop',
      targetX: target.position.x,
      targetY: target.position.y,
    });
    if (gap <= 5) return;
    // Land before the blow: faster than its speed if the attack is quick
    const duration = Math.min(gap / HOP_HOP.speed, champion.basicAttacks.getDamageDelay() * 0.8);
    champion.forcedMovement = {
      direction: toTarget.normalized(),
      distance: gap,
      duration,
      elapsed: 0,
      type: 'dash',
    };
    champion.dashAbilityId = 'hop_hop';
    champion.direction = toTarget.normalized();
  },

  onMeleeAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number; dealt: number },
    context: ServerGameContext
  ): void {
    const hop = hopOf(champion);
    if (hop.hopTarget !== target.id) return;
    hop.hopTarget = undefined;
    if (target.isDead) return;
    const bonus = HOP_HOP.bonusBase + HOP_HOP.bonusPerLevel * champion.level + HOP_HOP.bonusAdRatio * attack.attackDamage;
    champion.withDamageKind('basic', () => target.takeDamage(bonus, 'physical', champion.id, context));
  },

  onAbilityCast(champion: ServerChampion, abilityId: string): void {
    if (abilityId === 'hop_e') champion.passiveState.cooldownRemaining = 0;
  },

  updatePassiveState(champion: ServerChampion): void {
    champion.passiveState.isActive = hopReady(champion);
  },
};
