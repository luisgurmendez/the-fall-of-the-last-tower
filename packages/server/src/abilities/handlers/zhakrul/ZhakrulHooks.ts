/**
 * Zhak'rul's rules beyond his abilities' generic execution:
 * - Ancient Venom (passive): every basic attack that lands gives its target
 *   a dose of his venom (venom.ts)
 */

import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { poison } from './venom';

export const zhakrulHooks: IChampionHooks = {
  championId: 'zhakrul',

  onMeleeAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    _attack: { attackDamage: number; abilityPower: number; dealt: number },
    context: ServerGameContext
  ): void {
    poison(champion, target, 1, context);
  },
};
