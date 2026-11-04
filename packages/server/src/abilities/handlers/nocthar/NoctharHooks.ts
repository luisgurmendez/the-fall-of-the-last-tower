/**
 * Nocthar's rules beyond his abilities:
 * - Nobody Leaves (passive): an enemy unit (a minion, a monster or a
 *   champion; not a summon) dying within reach rises as a Hollow where it
 *   fell, if the passive is ready and he has fewer than 5; then it waits
 *   (noctharRaiseCooldown). A champion rises as a big one. With the colossus
 *   alive none rise: enemies dying near it heal it instead
 * - Heed Me's charge waits its cooldown (the slot's passiveCooldownRemaining
 *   shows it)
 * - Colossus of Bones: in its cast time the Hollows run to where it will
 *   rise; stunned or silenced, they come back and R returns in 10 s. When
 *   the colossus falls (or crumbles as he dies) his W, E and R are back and
 *   R's cooldown starts (army.ts)
 *
 * His passive's snapshot: isActive while the colossus lives, stacks his
 * Hollows, cooldownRemaining the wait to raise the next.
 */

import { EntityType, NOCTHAR_KIT, noctharRaiseCooldown, type Vector } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { colossusOf, endColossus, hollowsOf, raiseHollow } from './army';
import { noctharState } from './state';

/** The units whose deaths raise Hollows (or heal the colossus) */
function raisable(dead: ServerEntity): boolean {
  if ((dead as { ownerId?: string }).ownerId !== undefined) return false;
  return dead.entityType === EntityType.CHAMPION || dead.entityType === EntityType.MINION ||
    dead.entityType === EntityType.JUNGLE_CAMP;
}

export const noctharHooks: IChampionHooks = {
  championId: 'nocthar',

  onUnitDied(champion: ServerChampion, dead: ServerEntity, context: ServerGameContext): void {
    const state = noctharState(champion);
    if (dead.id === state.colossusId) {
      endColossus(champion, context);
      return;
    }
    if (champion.isDead || dead.side === champion.side || !raisable(dead)) return;

    const colossus = colossusOf(champion, context);
    if (colossus) {
      if (dead.position.distanceTo(colossus.position) > NOCTHAR_KIT.raiseRadius) return;
      const share = dead.entityType === EntityType.CHAMPION ? NOCTHAR_KIT.colossusHealPerChampion : NOCTHAR_KIT.colossusHealPerUnit;
      colossus.heal(colossus.maxHealth * share, context, champion.id);
      return;
    }

    if (state.raiseCooldown > 0) return;
    if (dead.position.distanceTo(champion.position) > NOCTHAR_KIT.raiseRadius) return;
    if (hollowsOf(champion, context).length >= NOCTHAR_KIT.maxHollows) return;
    raiseHollow(champion, dead.position, dead.entityType === EntityType.CHAMPION, context);
    state.raiseCooldown = noctharRaiseCooldown(champion.level);
  },

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    const state = noctharState(champion);
    const now = context.getGameTime();
    const elapsed = state.countedAt === null ? 0 : Math.max(0, now - state.countedAt);
    state.countedAt = now;
    state.raiseCooldown = Math.max(0, state.raiseCooldown - elapsed);
    state.chargeCooldown = Math.max(0, state.chargeCooldown - elapsed);

    // The colossus gone some other way (removed): his abilities are back
    if (state.colossusId && !colossusOf(champion, context)) endColossus(champion, context);

    champion.passiveState.isActive = state.colossusId !== null;
    champion.passiveState.stacks = hollowsOf(champion, context).length;
    champion.passiveState.cooldownRemaining = state.raiseCooldown;
    if (champion.abilityInSlot('E') === 'nocthar_e') champion.abilityStates.E.passiveCooldownRemaining = state.chargeCooldown;
  },

  onCastStart(champion: ServerChampion, abilityId: string, target: Vector | null, context: ServerGameContext): void {
    if (abilityId !== 'nocthar_r' || !target) return;
    for (const hollow of hollowsOf(champion, context)) hollow.command({ kind: 'move', point: target }, context);
  },

  onCastInterrupted(champion: ServerChampion, abilityId: string, context: ServerGameContext): void {
    if (abilityId !== 'nocthar_r') return;
    for (const hollow of hollowsOf(champion, context)) hollow.command({ kind: 'follow' }, context);
    champion.abilityStates.R.cooldownRemaining = NOCTHAR_KIT.rInterruptedCooldown;
    champion.abilityStates.R.cooldownTotal = NOCTHAR_KIT.rInterruptedCooldown;
  },
};
