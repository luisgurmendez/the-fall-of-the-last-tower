/**
 * Fenris's rules beyond his abilities' generic execution:
 * - Adrenaline Rush (passive): under 40% health he's feral: fenris_feral
 *   (movement speed, refreshed each tick), his abilities deal more damage
 *   and Vicious Bite heals twice as much (FenrisQHandler)
 * - Bloodthirst (R): while fenris_bloodthirst lasts, his basic attacks heal
 *   him a share of their damage, and an enemy champion he kills heals him
 *   to full (and, feral, restores his mana): an ABILITY_CAST fenris_r_feast
 *   for the VFX
 */

import { FENRIS_FERAL, GameEventType } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';

/** Feral's speed lasts this long, refreshed every tick while he's hurt */
const FERAL_REFRESH = 0.3;

/**
 * Whether he's feral: under his share of health, now (his abilities' damage
 * and Vicious Bite's heal go by this, not by fenris_feral, which lingers a
 * moment for the speed)
 */
export const isFeral = (champion: ServerChampion) => champion.health < champion.maxHealth * FENRIS_FERAL.health;

export const fenrisHooks: IChampionHooks = {
  championId: 'fenris',

  getAbilityDamageMultiplier(champion: ServerChampion): number {
    return isFeral(champion) ? 1 + FENRIS_FERAL.damageBonus : 1;
  },

  onMeleeAttackHit(
    champion: ServerChampion,
    _target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number; dealt: number },
    context: ServerGameContext
  ): void {
    if (!champion.hasEffect('fenris_bloodthirst')) return;
    const rank = champion.abilityStates.R.rank;
    const share = FENRIS_FERAL.lifeSteal[Math.max(0, Math.min(rank, FENRIS_FERAL.lifeSteal.length) - 1)];
    champion.heal(attack.dealt * share, context, champion.id);
  },

  onChampionKill(champion: ServerChampion, _victim, context: ServerGameContext): void {
    if (!champion.hasEffect('fenris_bloodthirst')) return;
    const feral = isFeral(champion);
    champion.heal(champion.maxHealth, context, champion.id);
    if (feral) champion.resource = champion.maxResource;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'fenris_r_feast',
      targetX: champion.position.x,
      targetY: champion.position.y,
    });
  },

  updatePassiveState(champion: ServerChampion): void {
    const feral = !champion.isDead && isFeral(champion);
    champion.passiveState.isActive = feral;
    if (feral) champion.applyEffect('fenris_feral', FERAL_REFRESH, champion.id);
  },
};
