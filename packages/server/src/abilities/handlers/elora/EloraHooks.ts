/**
 * Elora's rules beyond her abilities' generic execution:
 * - Proficient Archer (passive): every third basic attack on the same target
 *   strikes a weak point for bonus physical damage. The count is the
 *   passive's stacks (0-2), and the arrow that will strike is drawn as
 *   elora_weak_auto
 * - Poison Arrow (Q): while elora_poison_arrow lasts, her next arrow
 *   (elora_poison_auto) deals bonus damage, slows and poisons: elora_venom
 *   on the target and magic damage ticks over 3 seconds, by Q's rank
 */

import {
  calculateAbilityValue,
  getAbilityDefinition,
  ELORA_HUNT,
  ELORA_POISON,
} from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { applyEffectsToEntity, getScalingStats } from '../../generic/AbilityHelpers';

/** Poison Arrow's slow (for as long as the poison) */
const POISON_SLOW = 'slow_20';

interface AimState {
  /** The target her last arrows hit */
  aimTarget?: string;
  /** How many arrows in a row hit it (0-2) */
  aimCount?: number;
}

function aimOf(champion: ServerChampion): AimState {
  return (champion.passiveState.customData ??= {}) as AimState;
}

export const eloraHooks: IChampionHooks = {
  championId: 'elora',

  basicAttackProjectileType(champion: ServerChampion, target: ServerEntity): string | undefined {
    if (champion.hasEffect('elora_poison_arrow')) return 'elora_poison_auto';
    const aim = aimOf(champion);
    if (aim.aimTarget === target.id && (aim.aimCount ?? 0) >= ELORA_HUNT.weakPointEvery - 1) return 'elora_weak_auto';
    return undefined;
  },

  onRangedAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number },
    context: ServerGameContext
  ): void {
    strikeWeakPoint(champion, target, attack.attackDamage, context);
    if (champion.hasEffect('elora_poison_arrow')) {
      poisonArrow(champion, target, attack, context);
    }
  },

  updatePassiveState(champion: ServerChampion): void {
    champion.passiveState.stacks = aimOf(champion).aimCount ?? 0;
  },
};

/** Proficient Archer: the third arrow in a row on the same target hits a weak point */
function strikeWeakPoint(champion: ServerChampion, target: ServerEntity, attackDamage: number, context: ServerGameContext): void {
  const aim = aimOf(champion);
  aim.aimCount = aim.aimTarget === target.id ? (aim.aimCount ?? 0) + 1 : 1;
  aim.aimTarget = target.id;
  if (aim.aimCount < ELORA_HUNT.weakPointEvery) return;

  aim.aimCount = 0;
  if (target.isDead) return;
  const bonus = ELORA_HUNT.weakPointBase + ELORA_HUNT.weakPointPerLevel * champion.level
    + ELORA_HUNT.weakPointAdRatio * attackDamage;
  target.takeDamage(bonus, 'physical', champion.id, context);
}

/** Poison Arrow: bonus damage, a slow, and poison ticks while the venom lasts */
function poisonArrow(
  champion: ServerChampion,
  target: ServerEntity,
  attack: { attackDamage: number; abilityPower: number },
  context: ServerGameContext
): void {
  champion.activeEffects = champion.activeEffects.filter(effect => effect.definitionId !== 'elora_poison_arrow');
  const arrow = getAbilityDefinition('elora_q');
  const rank = champion.abilityStates.Q.rank;
  if (!arrow?.damage || rank <= 0 || target.isDead) return;

  target.takeDamage(calculateAbilityValue(arrow.damage.scaling, rank, attack), arrow.damage.type, champion.id, context);
  if (target.isDead) return;
  // Champions and minions hold effects; only champions can be cleansed of the venom
  applyEffectsToEntity(target, [POISON_SLOW, 'elora_venom'], ELORA_HUNT.poisonDuration, champion.id);
  const cleansed = () => 'hasEffect' in target && !(target as ServerEntity & { hasEffect(id: string): boolean }).hasEffect('elora_venom');

  const poison = calculateAbilityValue(ELORA_POISON, rank, getScalingStats(champion, champion.getStats()));
  const tick = poison / ELORA_HUNT.poisonTicks;
  const interval = ELORA_HUNT.poisonDuration / ELORA_HUNT.poisonTicks;
  for (let i = 1; i <= ELORA_HUNT.poisonTicks; i++) {
    context.schedule(interval * i, () => {
      // Cleansed or dead: the poison is gone
      if (target.isDead || cleansed()) return;
      target.takeDamage(tick, 'magic', champion.id, context);
    });
  }
}
