/**
 * ChampionDebug - What a champion is doing, for the debug overlay (see
 * game/DebugReport.ts): where it's walking, what it's attacking, its
 * crowd control and effects, and its abilities' reach.
 */

import { getAbilityDefinition, type AbilitySlot, type DebugUnit, type Vector } from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

const SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];

/** Its state in a few words: the first of these that holds */
function championState(champion: ServerChampion): string {
  const cc = champion.ccStatus;
  if (champion.isDead) return 'dead';
  if (champion.isRecalling) return 'recalling';
  if (champion.forcedMovement) return champion.forcedMovement.type === 'dash' ? 'dashing' : 'knocked back';
  if (cc.isStunned) return 'stunned';
  if (champion.targetEntityId) return 'attacking';
  if (champion.targetPosition) return champion.attackMoveTarget ? 'attack-moving' : 'walking';
  return 'idle';
}

export function describeChampion(champion: ServerChampion, context: ServerGameContext): DebugUnit {
  const notes: string[] = [];
  const cc = champion.ccStatus;
  const ccNames = [
    cc.isRooted && 'rooted',
    cc.isSilenced && 'silenced',
    cc.isGrounded && 'grounded',
    cc.isDisarmed && 'disarmed',
    cc.isTaunted && 'taunted',
  ].filter((name): name is string => !!name);
  if (ccNames.length > 0) notes.push(ccNames.join(', '));
  if (champion.inCombat) notes.push('in combat');
  for (const effect of champion.activeEffects) {
    notes.push(`${effect.definitionId} ${effect.timeRemaining.toFixed(1)}s`);
  }

  const waypoints: Vector[] = context.pathFollower.remainingWaypoints(champion.id)
    ?? (champion.targetPosition ? [champion.targetPosition] : []);
  const attackMove = champion.attackMoveTarget;
  if (attackMove && !waypoints.some(point => point.equals(attackMove, 1))) waypoints.push(attackMove);

  const abilities: NonNullable<DebugUnit['abilities']> = [];
  for (const slot of SLOTS) {
    if (champion.abilityRanks[slot] <= 0) continue;
    const definition = getAbilityDefinition(champion.abilityInSlot(slot));
    if (!definition?.range) continue;
    abilities.push({ slot, range: definition.range, radius: definition.aoeRadius });
  }

  return {
    entityId: champion.id,
    radius: champion.getRadius(),
    attackRange: champion.getAttackRange(),
    sight: champion.sightRange,
    targetId: champion.targetEntityId,
    path: waypoints.map(point => ({ x: point.x, y: point.y })),
    state: championState(champion),
    notes,
    abilities,
  };
}
