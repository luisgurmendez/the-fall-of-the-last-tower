/**
 * Calamitus's rules beyond his abilities:
 * - Lavaborn (passive): standing in his own lava he gains armor and magic
 *   resist (calamitus_lavaborn and calamitus_lavaborn_mr, refreshed each
 *   tick); the passive shows as active meanwhile
 */

import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { inLava } from './lava';

/** The resists last this long, refreshed every tick while he's in his lava */
const LAVABORN_REFRESH = 0.3;

export const calamitusHooks: IChampionHooks = {
  championId: 'calamitus',

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    const standing = !champion.isDead && inLava(champion, context, champion.position);
    champion.passiveState.isActive = standing;
    if (!standing) return;
    champion.applyEffect('calamitus_lavaborn', LAVABORN_REFRESH, champion.id);
    champion.applyEffect('calamitus_lavaborn_mr', LAVABORN_REFRESH, champion.id);
  },
};
