/**
 * Hop-To-Eat's rules beyond its abilities' generic execution:
 * - Hop to It! (passive): every few seconds its basic attack reaches much
 *   further: an attack that starts out of its melee reach hops onto the
 *   target first (a dash timed to land before the blow), and the attack
 *   deals bonus physical damage. The passive's cooldown is the time to the
 *   next hop; an ABILITY_CAST hop_hop marks each hop for the VFX
 * - Bunny Hop (E): readies the next hop at once
 */

import { GameEventType, HOP_HOP } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';

interface HopState {
  /** The target of the attack that hopped, until its blow lands */
  hopTarget?: string;
}

function hopOf(champion: ServerChampion): HopState {
  return (champion.passiveState.customData ??= {}) as HopState;
}

const hopReady = (champion: ServerChampion) => champion.passiveState.cooldownRemaining <= 0;

export const hopHooks: IChampionHooks = {
  championId: 'hop',

  getAttackRange(champion: ServerChampion, range: number): number {
    return hopReady(champion) ? Math.max(range, HOP_HOP.reach) : range;
  },

  onBasicAttackStart(champion: ServerChampion, target: ServerEntity, context: ServerGameContext): void {
    if (!hopReady(champion)) return;
    champion.passiveState.cooldownRemaining = HOP_HOP.every;
    hopOf(champion).hopTarget = target.id;

    const toTarget = target.position.subtracted(champion.position);
    const gap = toTarget.length() - champion.getRadius() - target.getRadius() - champion.definition.baseStats.attackRange * 0.6;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'hop_hop',
      targetX: target.position.x,
      targetY: target.position.y,
    });
    if (gap <= 5 || !champion.ccStatus.canMove) return;
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
    target.takeDamage(bonus, 'physical', champion.id, context);
  },

  onAbilityCast(champion: ServerChampion, abilityId: string): void {
    if (abilityId === 'hop_e') champion.passiveState.cooldownRemaining = 0;
  },

  updatePassiveState(champion: ServerChampion): void {
    champion.passiveState.isActive = hopReady(champion);
  },
};
