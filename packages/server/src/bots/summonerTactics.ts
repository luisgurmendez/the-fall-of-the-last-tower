/**
 * When a bot casts its summoner spells (D, F). Each spell has a moment, read
 * from the bot's situation:
 * - Purge: stunned or rooted with an enemy champion near
 * - Mend, Aegis: low on health while fighting or being chased
 * - Blink: away from a chaser when nearly dead, or onto a fleeing enemy
 *   that's nearly dead and just out of reach
 * - Haste: running from a chaser, or after a weakened enemy out of reach
 * - Scorch: on an enemy champion low enough that the burn may finish it
 * - Hinder: on the enemy champion in a fight we're losing
 * - Reap: on a jungle monster or minion it would kill
 */

import { InputType, SUMMONER_SPELLS, Vector, EntityType, type SummonerSpellId } from '@siege/shared';
import type { BotInput } from './BotController';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

export interface SummonerSituation {
  /** The bot is heading home hurt */
  retreating: boolean;
  /** The bot is fighting the enemy champion */
  fighting: boolean;
  /** The nearest visible enemy champion */
  enemy: ServerChampion | null;
  /** Where the bot runs to */
  spawn: Vector;
}

/** Health ratio under which Mend and Aegis are worth it */
const LOW_HEALTH = 0.3;
/** Health ratio under which Blink is spent on escaping */
const DESPERATE_HEALTH = 0.2;
/** An enemy this close is chasing (Blink, Haste) */
const CHASE_DISTANCE = 350;
/** An enemy this close makes a stun or root dangerous (Purge) */
const DANGER_DISTANCE = 500;
/** Health ratio under which a fleeing enemy is worth a Blink */
const FINISHABLE = 0.15;

/** The spell to cast now, if any */
export function chooseSummonerSpell(
  champion: ServerChampion,
  situation: SummonerSituation,
  context: ServerGameContext,
): BotInput | null {
  const ready = champion.summoners.getState()
    .map((spell, slot) => ({ id: spell.id, slot: slot as 0 | 1, ready: spell.cooldownRemaining <= 0 }))
    .filter(spell => spell.ready);
  if (ready.length === 0 || champion.isDead) return null;

  const { enemy, retreating, fighting, spawn } = situation;
  const healthRatio = champion.health / champion.maxHealth;
  const distance = enemy ? enemy.position.distanceTo(champion.position) : Infinity;
  const enemyRatio = enemy ? enemy.health / enemy.maxHealth : 1;
  const inDanger = (fighting || retreating) && distance < DANGER_DISTANCE;

  for (const { id, slot } of ready) {
    const cast = (target: { x?: number; y?: number; entityId?: string } = {}): BotInput => ({
      type: InputType.SUMMONER_SPELL,
      slot,
      targetX: target.x,
      targetY: target.y,
      targetEntityId: target.entityId,
    });
    const range = SUMMONER_SPELLS[id as SummonerSpellId].range ?? 0;

    switch (id) {
      case 'purge':
        if ((champion.ccStatus.isStunned || champion.ccStatus.isRooted) && distance < DANGER_DISTANCE) return cast();
        break;
      case 'mend':
      case 'aegis':
        if (healthRatio < LOW_HEALTH && inDanger) return cast();
        break;
      case 'blink': {
        if (retreating && healthRatio < DESPERATE_HEALTH && distance < CHASE_DISTANCE) {
          const away = champion.position.added(Vector.direction(champion.position, spawn).scaled(range));
          return cast({ x: away.x, y: away.y });
        }
        const reach = champion.getAttackRange() + (enemy?.getRadius() ?? 0);
        if (enemy && fighting && enemyRatio < FINISHABLE && healthRatio > enemyRatio && distance > reach && distance < reach + range) {
          return cast({ x: enemy.position.x, y: enemy.position.y, entityId: enemy.id });
        }
        break;
      }
      case 'haste':
        if (retreating && distance < CHASE_DISTANCE) return cast();
        if (enemy && fighting && enemyRatio < 0.3 && distance > champion.getAttackRange() + 100) return cast();
        break;
      case 'scorch': {
        // Its burn plus what the fight deals: worth it on an enemy already low
        if (enemy && distance <= range + enemy.getRadius() && enemyRatio < 0.3 && (fighting || enemyRatio < 0.15)) {
          return cast({ x: enemy.position.x, y: enemy.position.y, entityId: enemy.id });
        }
        break;
      }
      case 'hinder':
        if (enemy && fighting && distance <= range + enemy.getRadius() && healthRatio < enemyRatio && healthRatio < 0.6) {
          return cast({ x: enemy.position.x, y: enemy.position.y, entityId: enemy.id });
        }
        break;
      case 'reap': {
        const strike = reapTarget(champion, range, context);
        if (strike) return cast({ x: strike.position.x, y: strike.position.y, entityId: strike.id });
        break;
      }
    }
  }
  return null;
}

/** Reap's damage at the champion's level (see the spell's description) */
function reapDamage(champion: ServerChampion): number {
  return 450 + 25 * champion.level;
}

/** A big jungle monster in Reap's range that it would kill */
function reapTarget(champion: ServerChampion, range: number, context: ServerGameContext) {
  return context.getEntitiesInRadius(champion.position, range + 40).find(unit =>
    unit.entityType === EntityType.JUNGLE_CAMP && !unit.isDead &&
    unit.maxHealth >= reapDamage(champion) && unit.health <= reapDamage(champion) &&
    unit.position.distanceTo(champion.position) <= range + unit.getRadius()) ?? null;
}
