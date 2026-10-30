/**
 * LumeHooks - Guiding Glow follows the Light Orb
 *
 * Lume's passive and orb abilities depend on the Light Orb being alive:
 * - Orb alive: passive active, Q/W/E enabled
 * - Orb destroyed (by R): passive shows the orb respawn timer, Q/W/E disabled
 */

import { EntityType } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';

export const lumeHooks: IChampionHooks = {
  championId: 'lume',

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    // Find the light orb owned by this champion
    const orb = context.getAllEntities().find(
      e => e.entityType === EntityType.LIGHT_ORB && (e as any).ownerId === champion.id
    );

    if (orb) {
      const orbSnapshot = orb.toSnapshot() as any;
      if (orbSnapshot.state === 'destroyed') {
        // Orb is destroyed - show respawn cooldown, disable abilities
        champion.passiveState.isActive = false;
        champion.passiveState.cooldownRemaining = orbSnapshot.respawnTimeRemaining;
        champion.abilityStates.Q.isDisabled = true;
        champion.abilityStates.W.isDisabled = true;
        champion.abilityStates.E.isDisabled = true;
      } else {
        // Orb is alive - passive is active, enable abilities
        champion.passiveState.isActive = true;
        champion.passiveState.cooldownRemaining = 0;
        champion.abilityStates.Q.isDisabled = false;
        champion.abilityStates.W.isDisabled = false;
        champion.abilityStates.E.isDisabled = false;
      }
    }
  },
};
