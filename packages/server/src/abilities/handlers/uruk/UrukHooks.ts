/**
 * Urûk's rules beyond his abilities' generic execution:
 * - Hunter's Instinct (passive): while an enemy champion his side sees within
 *   800 is under half health, he gets uruk_hunt (movement speed) and
 *   uruk_hunt_speed (attack speed), refreshed each tick
 * - Spear Charge (W): the charged attack's bonus damage, then the reach goes
 *   back; while uruk_piercing lasts his physical damage ignores some armor
 * - Silver Scales (E): when the shield breaks or runs out it bursts in frost
 *   around him (an ABILITY_CAST uruk_e_burst for the VFX)
 */

import { calculateAbilityValue, canAbilityAffectEntityType, getAbilityDefinition, GameEventType } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { getScalingStats, applyEffectsToEntity } from '../../generic/AbilityHelpers';

/** Hunter's Instinct: an enemy champion this close... */
const HUNT_RANGE = 800;
/** ...under this health ratio */
const HUNT_HEALTH = 0.5;
/** Its buffs last this long, refreshed every tick while the hunt is on */
const HUNT_REFRESH = 0.3;

/** Spear Charge's armor penetration at rank 1, and per rank after */
const PIERCING_BASE = 10;
const PIERCING_PER_RANK = 4;

/** The scales burst if the shield was there this recently (not after a death and respawn) */
const SCALES_GRACE = 0.5;

export const urukHooks: IChampionHooks = {
  championId: 'uruk',

  getArmorPenetration(champion: ServerChampion): number {
    if (!champion.hasEffect('uruk_piercing')) return 0;
    const rank = champion.abilityStates.W.rank;
    return rank > 0 ? PIERCING_BASE + PIERCING_PER_RANK * (rank - 1) : 0;
  },

  onMeleeAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number },
    context: ServerGameContext
  ): void {
    if (!champion.hasEffect('uruk_spear_charge')) return;
    const spearCharge = getAbilityDefinition('uruk_w');
    const rank = champion.abilityStates.W.rank;
    if (spearCharge?.damage && rank > 0 && !target.isDead) {
      const bonus = calculateAbilityValue(spearCharge.damage.scaling, rank, attack);
      target.takeDamage(bonus, spearCharge.damage.type, champion.id, context);
    }
    // Spent: the reach goes back
    champion.activeEffects = champion.activeEffects.filter(effect => effect.definitionId !== 'uruk_spear_charge');
    champion.setTransformAttackRange(champion.getStats().attackRange, 0);
  },

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    if (champion.isDead) return;
    hunt(champion, context);
    burstScales(champion, context);
  },
};

/** Hunter's Instinct: faster near a hurt enemy champion */
function hunt(champion: ServerChampion, context: ServerGameContext): void {
  const prey = context.getAllChampions().some(enemy =>
    enemy.side !== champion.side && !enemy.isDead &&
    enemy.health / enemy.maxHealth < HUNT_HEALTH &&
    enemy.position.distanceTo(champion.position) <= HUNT_RANGE &&
    context.isVisibleTo(enemy, champion.side));
  if (!prey) return;
  champion.applyEffect('uruk_hunt', HUNT_REFRESH, champion.id);
  champion.applyEffect('uruk_hunt_speed', HUNT_REFRESH, champion.id);
}

/**
 * Silver Scales are up (UrukEHandler, as it grants them): they burst when
 * they're gone, even broken before the next tick looks at them.
 */
export function scalesRaised(champion: ServerChampion, context: ServerGameContext): void {
  (champion.passiveState.customData ??= {}).scalesSeenAt = context.getGameTime();
}

/** Silver Scales: the shield gone (broken or run out) bursts in frost */
function burstScales(champion: ServerChampion, context: ServerGameContext): void {
  const data = (champion.passiveState.customData ??= {});
  const now = context.getGameTime();
  if (champion.shields.some(shield => shield.sourceId === 'uruk_e' && shield.amount > 0)) {
    data.scalesSeenAt = now;
    return;
  }
  const seenAt = data.scalesSeenAt as number | undefined;
  if (seenAt === undefined) return;
  delete data.scalesSeenAt;
  if (now - seenAt > SCALES_GRACE) return;

  const scales = getAbilityDefinition('uruk_e');
  const rank = champion.abilityStates.E.rank;
  if (!scales?.damage || rank <= 0) return;
  const damage = calculateAbilityValue(scales.damage.scaling, rank, getScalingStats(champion, champion.getStats()));
  const radius = scales.aoeRadius ?? 170;
  for (const entity of context.getEntitiesInRadius(champion.position, radius)) {
    if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(scales, entity.entityType)) continue;
    entity.takeDamage(damage, scales.damage.type, champion.id, context);
    applyEffectsToEntity(entity, scales.appliesEffects ?? [], scales.effectDuration ?? 1, champion.id);
  }
  context.addEvent(GameEventType.ABILITY_CAST, {
    entityId: champion.id,
    abilityId: 'uruk_e_burst',
    targetX: champion.position.x,
    targetY: champion.position.y,
  });
}
