/**
 * Kip's rules beyond his abilities:
 * - The Bigger They Are (passive): his basic attack on an enemy champion he
 *   marked (kip_mark from him) pops the mark for bonus physical damage, as
 *   part of the attack (kipPopDamage: his attack damage when he attacked, a
 *   share of the target's max health and of how much more max health it has
 *   than him). Only his basic attacks pop his marks; the arrow that will pop
 *   one is drawn as kip_pop_auto. The passive's stacks count the enemy
 *   champions he has marked (for Show Them All)
 * - Run Them Down (W, passive part): faster the more crit chance he has
 *
 * The mark's sight and the speed his team's attacks on the marked give
 * them are the mark's own (effects.ts: revealsHolder, rewardsAttackers).
 */

import { KIP_KIT, kipPopDamage, type FullChampionStats } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { isMarkedBy, markedEnemies } from './marks';

export const kipHooks: IChampionHooks = {
  championId: 'kip',

  basicAttackProjectileType(champion: ServerChampion, target: ServerEntity): string | undefined {
    return isMarkedBy(target, champion) ? 'kip_pop_auto' : undefined;
  },

  onRangedAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number },
    context: ServerGameContext
  ): void {
    if (target.isDead || !isMarkedBy(target, champion)) return;
    const marked = target as ServerChampion;
    marked.removeEffect(KIP_KIT.markEffect);
    const bonus = kipPopDamage(attack.attackDamage, marked.getStats().maxHealth, champion.getStats().maxHealth);
    champion.withDamageKind('basic', () => target.takeDamage(bonus, 'physical', champion.id, context));
  },

  modifyStats(champion: ServerChampion, stats: FullChampionStats): void {
    const rank = champion.abilityStates.W.rank;
    if (rank <= 0) return;
    const atFullCrit = KIP_KIT.wSpeedAtFullCrit[Math.min(rank, KIP_KIT.wSpeedAtFullCrit.length) - 1];
    stats.movementSpeed *= 1 + Math.min(1, Math.max(0, stats.critChance)) * atFullCrit;
  },

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    const marks = markedEnemies(champion, context).length;
    champion.passiveState.stacks = marks;
    champion.passiveState.isActive = marks > 0;
  },
};
