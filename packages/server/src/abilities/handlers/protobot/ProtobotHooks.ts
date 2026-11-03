/**
 * Protobot's rules beyond his abilities' generic execution:
 * - Machine Learning (passive): each time an enemy champion damages him (at
 *   most once a second) he learns a lesson: a stack of protobot_learning
 *   (armor and magic resist, one effect). The lessons are the passive's
 *   stacks
 */

import { EntityType, PROTOBOT_MACHINE } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';

export const protobotHooks: IChampionHooks = {
  championId: 'protobot',

  onDamaged(champion: ServerChampion, source: ServerEntity | undefined): void {
    if (champion.isDead || !source || source.entityType !== EntityType.CHAMPION || source.side === champion.side) return;
    // Stateless once a second: a lesson learned less than a second ago still has nearly all its time
    const lesson = champion.getEffect('protobot_learning');
    if (lesson && lesson.timeRemaining > PROTOBOT_MACHINE.lessonDuration - PROTOBOT_MACHINE.lessonEvery) return;
    champion.applyEffect('protobot_learning', PROTOBOT_MACHINE.lessonDuration, champion.id);
  },

  updatePassiveState(champion: ServerChampion): void {
    const stacks = champion.getEffect('protobot_learning')?.stacks ?? 0;
    champion.passiveState.stacks = stacks;
    champion.passiveState.isActive = stacks > 0;
  },
};
