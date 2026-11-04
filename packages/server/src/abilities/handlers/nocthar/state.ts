/**
 * What Nocthar's kit remembers about each Nocthar: his passive's wait, his
 * E's charge wait and his colossus. Kept by champion (a new match's champions
 * start fresh).
 */

import type { ServerChampion } from '../../../simulation/ServerChampion';

export interface NoctharState {
  /** Seconds until Nobody Leaves raises another Hollow */
  raiseCooldown: number;
  /** Seconds until Heed Me's next order is a charge */
  chargeCooldown: number;
  /** His colossus while it lives */
  colossusId: string | null;
  /** Game time the waits were last counted down */
  countedAt: number | null;
}

const states = new WeakMap<ServerChampion, NoctharState>();

export function noctharState(champion: ServerChampion): NoctharState {
  let state = states.get(champion);
  if (!state) {
    state = { raiseCooldown: 0, chargeCooldown: 0, colossusId: null, countedAt: null };
    states.set(champion, state);
  }
  return state;
}
